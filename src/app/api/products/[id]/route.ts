import { withApiAuth } from '@/lib/auth/api'
import { ADMIN_ONLY } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { productUpdateSchema } from '@/lib/validations/product'
import { deactivateProduct, getProductById, updateProduct } from '@/services/product.service'

export const GET = withApiAuth<{ params: Promise<{ id: string }> }>(undefined, async (_request, ctx) => {
  const { id } = await ctx!.params
  const product = await getProductById(id)

  if (!product) {
    return errorResponse(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado')
  }

  return successResponse(product)
})

export const PUT = withApiAuth<{ params: Promise<{ id: string }> }>(ADMIN_ONLY, async (request, ctx) => {
  const { id } = await ctx!.params
  const body = await request.json()
  const parsed = productUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const product = await updateProduct(id, parsed.data)

  return successResponse(product)
})

export const DELETE = withApiAuth<{ params: Promise<{ id: string }> }>(ADMIN_ONLY, async (_request, ctx) => {
  const { id } = await ctx!.params
  const product = await deactivateProduct(id)

  return successResponse(product)
})
