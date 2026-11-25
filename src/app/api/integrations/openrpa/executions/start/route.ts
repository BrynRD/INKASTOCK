import { errorResponse, isOpenRpaAuthorized, successResponse } from '@/lib/api-utils'
import { startExecution } from '@/services/automation.service'

export async function POST(request: Request) {
  if (!isOpenRpaAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const body = await request.json()
  const executionId = body?.executionId
  const workflowName = body?.workflowName

  if (typeof executionId !== 'string' || typeof workflowName !== 'string') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const execution = await startExecution({ executionId, workflowName })

  return successResponse(execution, 201, 'Ejecución iniciada correctamente')
}
