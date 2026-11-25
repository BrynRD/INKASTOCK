import { errorResponse, isPowerAutomateAuthorized, successResponse } from '@/lib/api-utils'
import { getPendingTransfers } from '@/services/integration.service'

export async function GET(request: Request) {
  if (!isPowerAutomateAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const { searchParams } = new URL(request.url)
  const transfers = await getPendingTransfers(searchParams.get('status'))

  return successResponse(transfers)
}
