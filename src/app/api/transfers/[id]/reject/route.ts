import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { rejectTransfer } from '@/services/transfer.service'
import { notifyOperation } from '@/services/notification-center.service'

export const POST = withApiAuth<{ params: Promise<{ id: string }> }>(INVENTORY_WRITE_ROLES, async (request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  const body = await request.json().catch(() => ({}))
  try {
    const transfer = await rejectTransfer(id, actor, body.reason)
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Transfer',
      operationId: transfer.id,
      title: `Transferencia ${transfer.code} rechazada`,
      body: `Rechazada por ${actor.email ?? actor.id}. ${body.reason ?? ''}`.trim(),
      link: `/dashboard/transfers/${transfer.id}`,
      branchIds: [transfer.originBranchId, transfer.destinationBranchId],
    })
    return successResponse(transfer)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo rechazar la transferencia')
  }
})
