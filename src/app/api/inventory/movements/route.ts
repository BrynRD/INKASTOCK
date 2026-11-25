import { withApiAuth } from '@/lib/auth/api'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { movementCreateSchema } from '@/lib/validations/movement'
import type { MovementCreateInput } from '@/lib/validations/movement'
import { MovementType } from '@/generated/prisma/enums'
import { listMovements, registerAdjustment, registerEntry, registerExit } from '@/services/movement.service'
import { detectAlerts } from '@/services/alert.service'

const CONFLICT_CODES = new Set([
  'INSUFFICIENT_STOCK',
  'STOCK_CONCURRENCY_CONFLICT',
  'LOT_BRANCH_PRODUCT_MISMATCH',
  'LOT_DATA_REQUIRED',
  'INVALID_QUANTITY',
])

export const GET = withApiAuth(undefined, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)

  const result = await listMovements({
    productId: searchParams.get('productId') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
    type: (searchParams.get('type') ?? undefined) as MovementType | undefined,
    page,
    pageSize,
  })

  return successResponse(result)
})

async function register(input: MovementCreateInput) {
  if (input.type === MovementType.EXIT) {
    return registerExit(input)
  }

  if (input.type === MovementType.ENTRY) {
    return registerEntry(input)
  }

  if (input.type === MovementType.ADJUSTMENT && input.lotId) {
    return registerAdjustment({ ...input, lotId: input.lotId })
  }

  return null
}

export const POST = withApiAuth(INVENTORY_WRITE_ROLES, async (request, _context, user) => {
  const body = await request.json().catch(() => ({}))
  const parsed = movementCreateSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const input = { ...parsed.data, userId: user.id }

  if (input.type === MovementType.ADJUSTMENT && !input.lotId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'El campo lotId es obligatorio para ajustes')
  }

  try {
    const movement = await register(input)

    if (!movement) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Tipo de movimiento no soportado')
    }

    await detectAlerts()
    return successResponse(movement, 201, 'Operación realizada correctamente')
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'

    if (CONFLICT_CODES.has(code)) {
      return errorResponse(409, code, 'No se pudo completar el movimiento por un conflicto de inventario')
    }

    throw error
  }
})
