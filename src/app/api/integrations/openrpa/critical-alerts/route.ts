import { errorResponse, isOpenRpaAuthorized, successResponse } from '@/lib/api-utils'
import { getCriticalAlerts } from '@/services/automation.service'

export async function GET(request: Request) {
  if (!isOpenRpaAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branchId') ?? undefined
  const limit = Number(searchParams.get('limit') ?? 50)

  const result = await getCriticalAlerts(branchId, limit)

  return successResponse(result)
}
