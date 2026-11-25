import { withApiAuth } from '@/lib/auth/api'
import { ADMIN_ONLY } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { branchCreateSchema } from '@/lib/validations/branch'
import { createBranch, listBranches } from '@/services/branch.service'

export const GET = withApiAuth(undefined, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)

  const result = await listBranches({
    search: searchParams.get('search') ?? undefined,
    page,
    pageSize,
  })

  return successResponse(result)
})

export const POST = withApiAuth(ADMIN_ONLY, async (request) => {
  const body = await request.json()
  const parsed = branchCreateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const branch = await createBranch(parsed.data)

  return successResponse(branch, 201, 'Operación realizada correctamente')
})
