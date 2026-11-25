import { errorResponse, isPowerAutomateAuthorized, successResponse } from '@/lib/api-utils'
import { getAuthorizedReplenishments } from '@/services/integration.service'

export async function GET(request: Request) {
  if (!isPowerAutomateAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const { searchParams } = new URL(request.url)
  const replenishments = await getAuthorizedReplenishments(searchParams.get('status'))

  return successResponse(replenishments)
}
