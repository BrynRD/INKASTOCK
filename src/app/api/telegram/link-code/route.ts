import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { successResponse } from '@/lib/api-utils'
import { createTelegramLinkCode } from '@/services/telegram-handler.service'

export const POST = withApiAuth(ALL_ROLES, async (_request, _context, user) => {
  const result = await createTelegramLinkCode(user.id)
  return successResponse(result, 201, 'Código de vinculación generado')
})
