import { withApiAuth } from '@/lib/auth/api'
import { ADMIN_ONLY } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { branchUpdateSchema } from '@/lib/validations/branch'
import { deactivateBranch, getBranchById, updateBranch } from '@/services/branch.service'

export const GET = withApiAuth<{ params: Promise<{ id: string }> }>(undefined, async (_request, ctx) => {
  const { id } = await ctx!.params
  const branch = await getBranchById(id)

  if (!branch) {
    return errorResponse(404, 'BRANCH_NOT_FOUND', 'Sucursal no encontrada')
  }

  return successResponse(branch)
})

export const PUT = withApiAuth<{ params: Promise<{ id: string }> }>(ADMIN_ONLY, async (request, ctx) => {
  const { id } = await ctx!.params
  const body = await request.json()
  const parsed = branchUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const branch = await updateBranch(id, parsed.data)

  return successResponse(branch)
})

export const DELETE = withApiAuth<{ params: Promise<{ id: string }> }>(ADMIN_ONLY, async (_request, ctx) => {
  const { id } = await ctx!.params
  const branch = await deactivateBranch(id)

  return successResponse(branch)
})
