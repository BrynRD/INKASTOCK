import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { successResponse } from '@/lib/api-utils'
import { markAllNotificationsRead } from '@/services/notification-center.service'

export const POST = withApiAuth(ALL_ROLES, async (_request, _context, user) => {
  await markAllNotificationsRead(user.id)
  return successResponse({ ok: true })
})
