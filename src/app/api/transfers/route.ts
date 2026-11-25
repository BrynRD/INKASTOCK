import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { ALL_ROLES, INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { transferCreateSchema } from '@/lib/validations/transfer'
import { createTransfer, listTransfers } from '@/services/transfer.service'
import { notifyTransferCreated } from '@/services/notification.service'

const CONFLICT_CODES = new Set([
  'SAME_BRANCH',
  'EMPTY_TRANSFER',
  'INVALID_QUANTITY',
  'PRODUCT_NOT_FOUND',
  'INSUFFICIENT_STOCK',
  'BRANCH_FORBIDDEN',
])

export const GET = withApiAuth(ALL_ROLES, async (request) => {
  const { searchParams } = new URL(request.url)
  const result = await listTransfers({
    status: searchParams.get('status') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
    productId: searchParams.get('productId') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('pageSize') ?? 20),
  })
  return successResponse(result)
})

export const POST = withApiAuth(INVENTORY_WRITE_ROLES, async (request, _context, user) => {
  const body = await request.json()
  const parsed = transferCreateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')

  try {
    const transfer = await createTransfer(toActor(user), parsed.data)
    try {
      await notifyTransferCreated(transfer.id)
    } catch {
      return successResponse(transfer, 201, 'Transferencia creada; falló la notificación externa')
    }
    return successResponse(transfer, 201, 'Operación realizada correctamente')
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (CONFLICT_CODES.has(code)) return errorResponse(409, code, 'No se pudo crear la transferencia')
    throw error
  }
})
