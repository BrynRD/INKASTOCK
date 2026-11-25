import { withApiAuth } from '@/lib/auth/api'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { getAlertById, updateAlertStatus } from '@/services/alert.service'

export const GET = withApiAuth<{ params: Promise<{ id: string }> }>(undefined, async (_request, ctx) => {
  const { id } = await ctx!.params
  const alert = await getAlertById(id)

  if (!alert) {
    return errorResponse(404, 'ALERT_NOT_FOUND', 'Alerta no encontrada')
  }

  return successResponse(alert)
})

export const PUT = withApiAuth<{ params: Promise<{ id: string }> }>(undefined, async (request, ctx) => {
  const { id } = await ctx!.params
  const body = await request.json()
  const status = body.status

  if (!status) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const alert = await updateAlertStatus(id, status)

  return successResponse(alert)
})
