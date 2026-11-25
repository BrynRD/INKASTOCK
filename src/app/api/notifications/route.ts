import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { successResponse } from '@/lib/api-utils'
import { listNotifications } from '@/services/notification-center.service'

export const GET = withApiAuth(ALL_ROLES, async (_request, _context, user) => {
  const url = new URL(_request.url)
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '20'), 1), 100)
  const notifications = await listNotifications(user.id, { unreadOnly, limit })
  return successResponse(notifications)
})
