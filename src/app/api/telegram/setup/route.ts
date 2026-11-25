import { withApiAuth } from '@/lib/auth/api'
import { ADMIN_ONLY } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { configureTelegramWebhook } from '@/services/telegram.service'

export const POST = withApiAuth(ADMIN_ONLY, async () => {
  try {
    const result = await configureTelegramWebhook()
    return successResponse(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    return errorResponse(409, code, 'No se pudo configurar el webhook de Telegram')
  }
})
