import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { getTransfer } from '@/services/transfer.service'

export const GET = withApiAuth<{ params: Promise<{ id: string }> }>(ALL_ROLES, async (_request, ctx) => {
  const { id } = await ctx!.params
  const transfer = await getTransfer(id)
  if (!transfer) return errorResponse(404, 'NOT_FOUND', 'Transferencia no encontrada')
  return successResponse(transfer)
})
