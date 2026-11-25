import { errorResponse, isOpenRpaAuthorized, successResponse } from '@/lib/api-utils'
import { listExecutions } from '@/services/automation.service'

export async function GET(request: Request) {
  if (!isOpenRpaAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const { executions } = await listExecutions(20)

  return successResponse(executions)
}
