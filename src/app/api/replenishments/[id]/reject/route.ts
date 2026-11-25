import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { APPROVAL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { rejectReplenishment } from '@/services/replenishment.service'
import { notifyOperation } from '@/services/notification-center.service'

const handler = withApiAuth<{ params: Promise<{ id: string }> }>(APPROVAL_ROLES, async (request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  const body = await request.json().catch(() => ({}))
  try {
    const replenishment = await rejectReplenishment(id, actor, body.reason)
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Replenishment',
      operationId: replenishment.id,
      title: `Reposición ${replenishment.code} rechazada`,
      body: `Rechazada por ${actor.email ?? actor.id}. ${body.reason ?? ''}`.trim(),
      link: `/dashboard/replenishments/${replenishment.id}`,
      branchIds: [replenishment.branchId],
    })
    return successResponse(replenishment)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo rechazar la reposición')
  }
})

export const PUT = handler
export const POST = handler
