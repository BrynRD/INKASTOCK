import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { replenishmentCreateSchema } from '@/lib/validations/replenishment'
import { createReplenishment, listReplenishments } from '@/services/replenishment.service'
import { notifyReplenishmentCreated } from '@/services/notification.service'

export const GET = withApiAuth(undefined, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)

  const result = await listReplenishments({
    status: searchParams.get('status') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
    productId: searchParams.get('productId') ?? undefined,
    code: searchParams.get('code') ?? undefined,
    page,
    pageSize,
  })

  return successResponse(result)
})

const CONFLICT_CODES = new Set([
  'INVALID_QUANTITY',
  'BRANCH_FORBIDDEN',
  'PRODUCT_OR_BRANCH_NOT_FOUND',
  'PRODUCT_NOT_FOUND',
])

export const POST = withApiAuth(INVENTORY_WRITE_ROLES, async (request, _context, user) => {
  const body = await request.json()
  const parsed = replenishmentCreateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  try {
    const { replenishment, suggestion } = await createReplenishment(toActor(user), parsed.data)
    try {
      await notifyReplenishmentCreated(replenishment.id)
    } catch {
      return successResponse(
        { replenishment, suggestion, notificationError: true },
        201,
        'Reposición creada; falló la notificación externa',
      )
    }
    return successResponse({ replenishment, suggestion }, 201, 'Operación realizada correctamente')
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (CONFLICT_CODES.has(code)) return errorResponse(409, code, 'No se pudo crear la reposición')
    throw error
  }
})
