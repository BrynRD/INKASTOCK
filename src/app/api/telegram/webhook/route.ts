import { verifyTelegramSecret, type TelegramUpdate } from '@/services/telegram.service'
import { handleTelegramUpdate } from '@/services/telegram-handler.service'
import { errorResponse, successResponse } from '@/lib/api-utils'

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!verifyTelegramSecret(secret)) {
    return errorResponse(401, 'UNAUTHORIZED', 'Secreto de webhook inválido')
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return errorResponse(400, 'VALIDATION_ERROR', 'Cuerpo no válido')
  }

  try {
    await handleTelegramUpdate(update)
    return successResponse({ ok: true })
  } catch (error) {
    return errorResponse(500, 'TELEGRAM_HANDLER_ERROR', error instanceof Error ? error.message : 'Error')
  }
}
