import { errorResponse, isOpenRpaAuthorized, successResponse } from '@/lib/api-utils'
import { finishExecution } from '@/services/automation.service'

export async function POST(request: Request) {
  if (!isOpenRpaAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const body = await request.json()
  const executionId = body?.executionId
  const status = body?.status

  if (typeof executionId !== 'string' || (status !== 'SUCCESS' && status !== 'FAILED')) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const execution = await finishExecution({
    executionId,
    status,
    alertsFound: body.alertsFound,
    details: body.details,
  })

  return successResponse(execution)
}
