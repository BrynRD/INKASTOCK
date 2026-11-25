import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { APPROVAL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { authorizeTransfer } from '@/services/transfer.service'
import { notifyOperation } from '@/services/notification-center.service'

export const POST = withApiAuth<{ params: Promise<{ id: string }> }>(APPROVAL_ROLES, async (_request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  try {
    const transfer = await authorizeTransfer(id, actor)
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Transfer',
      operationId: transfer.id,
      title: `Transferencia ${transfer.code} autorizada`,
      body: `Autorizada por ${actor.email ?? actor.id}.`,
      link: `/dashboard/transfers/${transfer.id}`,
      branchIds: [transfer.originBranchId, transfer.destinationBranchId],
    })
    return successResponse(transfer)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo autorizar la transferencia')
  }
})
