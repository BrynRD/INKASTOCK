import { withApiAuth } from '@/lib/auth/api'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { lotCreateSchema } from '@/lib/validations/lot'
import { createLot, listLots } from '@/services/lot.service'

export const GET = withApiAuth(undefined, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)

  const result = await listLots({
    branchId: searchParams.get('branchId') ?? undefined,
    productId: searchParams.get('productId') ?? undefined,
    page,
    pageSize,
  })

  return successResponse(result)
})

export const POST = withApiAuth(INVENTORY_WRITE_ROLES, async (request) => {
  const body = await request.json()
  const parsed = lotCreateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const lot = await createLot(parsed.data)

  return successResponse(lot, 201, 'Operación realizada correctamente')
})
