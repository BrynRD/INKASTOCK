import { withApiAuth } from '@/lib/auth/api'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { getReply } from '@/services/chatbot.service'

export const POST = withApiAuth(undefined, async (request) => {
  const body = await request.json()
  const message = body?.message

  if (typeof message !== 'string' || message.trim().length < 2) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos')
  }

  const { reply, intent } = await getReply(message)

  return successResponse({ reply, intent }, 200, 'Respuesta generada correctamente')
})
