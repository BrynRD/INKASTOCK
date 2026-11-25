import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { dispatchTransfer } from '@/services/transfer.service'
import { notifyOperation } from '@/services/notification-center.service'

export const POST = withApiAuth<{ params: Promise<{ id: string }> }>(INVENTORY_WRITE_ROLES, async (_request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  try {
    const transfer = await dispatchTransfer(id, actor)
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Transfer',
      operationId: transfer.id,
      title: `Transferencia ${transfer.code} despachada`,
      body: `Despachada por ${actor.email ?? actor.id}.`,
      link: `/dashboard/transfers/${transfer.id}`,
      branchIds: [transfer.originBranchId, transfer.destinationBranchId],
    })
    return successResponse(transfer)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo despachar la transferencia')
  }
})
