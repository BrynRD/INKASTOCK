import { withApiAuth } from '@/lib/auth/api'
import { ADMIN_ONLY } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { productCreateSchema } from '@/lib/validations/product'
import { createProduct, listProducts } from '@/services/product.service'

export const GET = withApiAuth(undefined, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)

  const result = await listProducts({
    search: searchParams.get('search') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    page,
    pageSize,
  })

  return successResponse(result)
})

export const POST = withApiAuth(ADMIN_ONLY, async (request) => {
  const body = await request.json()
  const parsed = productCreateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const product = await createProduct(parsed.data)

  return successResponse(product, 201, 'Operación realizada correctamente')
})
