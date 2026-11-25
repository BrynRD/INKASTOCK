import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { transferConfirmSchema } from '@/lib/validations/transfer'
import { confirmTransferOrigin } from '@/services/transfer.service'
import { notifyOperation } from '@/services/notification-center.service'

export const POST = withApiAuth<{ params: Promise<{ id: string }> }>(INVENTORY_WRITE_ROLES, async (request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  const body = await request.json().catch(() => ({}))
  const parsed = transferConfirmSchema.safeParse(body)
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Datos de confirmación no válidos')

  try {
    const transfer = await confirmTransferOrigin(id, actor, parsed.data)
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Transfer',
      operationId: transfer.id,
      title: `Transferencia ${transfer.code} confirmada en origen`,
      body: `Confirmada por ${actor.email ?? actor.id}.`,
      link: `/dashboard/transfers/${transfer.id}`,
      branchIds: [transfer.originBranchId, transfer.destinationBranchId],
    })
    return successResponse(transfer)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo confirmar la transferencia')
  }
})
