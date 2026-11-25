import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { successResponse } from '@/lib/api-utils'
import { countUnreadNotifications } from '@/services/notification-center.service'

export const GET = withApiAuth(ALL_ROLES, async (_request, _context, user) => {
  const count = await countUnreadNotifications(user.id)
  return successResponse({ count })
})
