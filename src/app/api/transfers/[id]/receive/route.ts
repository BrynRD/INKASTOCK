import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { transferReceiveSchema } from '@/lib/validations/transfer'
import { receiveTransfer } from '@/services/transfer.service'
import { detectAlerts } from '@/services/alert.service'
import { notifyOperation } from '@/services/notification-center.service'

export const POST = withApiAuth<{ params: Promise<{ id: string }> }>(INVENTORY_WRITE_ROLES, async (request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  const body = await request.json().catch(() => ({}))
  const parsed = transferReceiveSchema.safeParse(body)
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Datos de recepción no válidos')

  try {
    const transfer = await receiveTransfer(id, actor, parsed.data)
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND')
    await detectAlerts()
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Transfer',
      operationId: transfer.id,
      title: `Transferencia ${transfer.code} recepcionada`,
      body: `Recepcionada por ${actor.email ?? actor.id}.`,
      link: `/dashboard/transfers/${transfer.id}`,
      branchIds: [transfer.originBranchId, transfer.destinationBranchId],
    })
    return successResponse(transfer)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo recepcionar la transferencia')
  }
})
