import { withApiAuth } from '@/lib/auth/api'
import { successResponse } from '@/lib/api-utils'
import { AlertStatus, AlertPriority, AlertType } from '@/generated/prisma/enums'
import { listAlerts } from '@/services/alert.service'

export const GET = withApiAuth(undefined, async (request) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 20)

  const result = await listAlerts({
    status: (searchParams.get('status') ?? undefined) as AlertStatus | undefined,
    priority: (searchParams.get('priority') ?? undefined) as AlertPriority | undefined,
    type: (searchParams.get('type') ?? undefined) as AlertType | undefined,
    branchId: searchParams.get('branchId') ?? undefined,
    productId: searchParams.get('productId') ?? undefined,
    page,
    pageSize,
  })

  return successResponse(result)
})
