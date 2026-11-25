import { errorResponse, isPowerAutomateAuthorized, successResponse } from '@/lib/api-utils'
import { finishExecution } from '@/services/automation.service'

export async function POST(request: Request) {
  if (!isPowerAutomateAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const body = await request.json()
  const executionId = body?.executionId
  const status = body?.status

  if (typeof executionId !== 'string' || (status !== 'SUCCESS' && status !== 'FAILED')) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  try {
    const execution = await finishExecution({
      executionId,
      status,
      alertsFound: body.alertsFound,
      details: body.details,
    })

    return successResponse(execution)
  } catch (error) {
    if (error instanceof Error && error.message === 'EXECUTION_NOT_FOUND') {
      return errorResponse(404, 'EXECUTION_NOT_FOUND', 'No existe una ejecución con ese identificador')
    }
    throw error
  }
}
