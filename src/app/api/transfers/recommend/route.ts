import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { transferRecommendSchema } from '@/lib/validations/transfer'
import { recommendTransfer } from '@/services/transfer.service'

export const POST = withApiAuth(ALL_ROLES, async (request) => {
  const parsed = transferRecommendSchema.safeParse(await request.json())
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')

  try {
    return successResponse(await recommendTransfer(parsed.data.productId, parsed.data.destinationBranchId))
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo calcular la recomendación')
  }
})
