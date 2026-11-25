import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { replenishmentReceiveSchema } from '@/lib/validations/replenishment'
import { receiveIntelligentReplenishment } from '@/services/replenishment.service'
import { detectAlerts } from '@/services/alert.service'
import { notifyOperation } from '@/services/notification-center.service'

const CONFLICT_CODES = new Set([
  'REPLENISHMENT_NOT_FOUND',
  'REPLENISHMENT_ALREADY_RECEIVED',
  'REPLENISHMENT_INVALID_STATE',
  'INVALID_QUANTITY',
  'LOT_QUANTITY_MISMATCH',
  'EXPIRATION_DATE_REQUIRED',
  'BRANCH_FORBIDDEN',
])

const handler = withApiAuth<{ params: Promise<{ id: string }> }>(INVENTORY_WRITE_ROLES, async (request, ctx, user) => {
  const { id } = await ctx!.params
  const actor = toActor(user)
  const body = await request.json().catch(() => ({}))
  const parsed = replenishmentReceiveSchema.safeParse(body)

  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Datos de recepción no válidos')
  }

  try {
    const replenishment = await receiveIntelligentReplenishment(id, actor, parsed.data)
    if (!replenishment) throw new Error('REPLENISHMENT_NOT_FOUND')
    await detectAlerts()
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: actor.id,
      operationType: 'Replenishment',
      operationId: replenishment.id,
      title: `Reposición ${replenishment.code} recepcionada`,
      body: `Recepcionada por ${actor.email ?? actor.id}.`,
      link: `/dashboard/replenishments/${replenishment.id}`,
      branchIds: [replenishment.branchId],
    })
    return successResponse(replenishment)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (CONFLICT_CODES.has(code)) return errorResponse(409, code, 'No se pudo recibir la reposición')
    throw error
  }
})

export const PUT = handler
export const POST = handler
