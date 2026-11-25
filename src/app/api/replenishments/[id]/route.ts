import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { getReplenishment } from '@/services/replenishment.service'

export const GET = withApiAuth<{ params: Promise<{ id: string }> }>(ALL_ROLES, async (_request, ctx) => {
  const { id } = await ctx!.params
  const replenishment = await getReplenishment(id)
  if (!replenishment) return errorResponse(404, 'NOT_FOUND', 'Reposición no encontrada')
  return successResponse(replenishment)
})
