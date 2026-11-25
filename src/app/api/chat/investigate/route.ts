import { withApiAuth } from '@/lib/auth/api'
import { toActor } from '@/lib/auth/actor'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { investigate } from '@/services/groq-agent.service'
import { getReply } from '@/services/chatbot.service'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  message: z.string().min(3).max(2000),
  productId: z.string().uuid().optional(),
})

export const POST = withApiAuth(ALL_ROLES, async (request, _context, user) => {
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'La pregunta no es válida')

  try {
    let result: { answer: string; evidence?: unknown; recommendation?: unknown; toolsUsed?: string[]; model?: string }

    // Preguntas de texto libre sin producto específico: usar chatbot.service (consulta BD real)
    if (!parsed.data.productId) {
      const { reply, intent } = await getReply(parsed.data.message)
      result = {
        answer: reply,
        evidence: { intent },
        recommendation: undefined,
        toolsUsed: [],
        model: 'chatbot-service',
      }
    } else {
      // Investigación con producto específico: usar agente de Groq
      const investigated = await investigate({
        message: parsed.data.message,
        actor: toActor(user),
        productId: parsed.data.productId,
      })
      result = {
        answer: investigated.answer,
        evidence: investigated.evidence,
        recommendation: investigated.recommendation,
        toolsUsed: investigated.toolsUsed,
        model: investigated.model,
      }
    }

    await prisma.chatMessage.createMany({
      data: [
        {
          userId: user.id,
          role: 'USER',
          content: parsed.data.message,
          channel: 'WEB',
          metadata: parsed.data.productId ? { productId: parsed.data.productId } : undefined,
        },
        {
          userId: user.id,
          role: 'ASSISTANT',
          content: result.answer,
          channel: 'WEB',
          metadata: {
            evidence: JSON.parse(JSON.stringify(result.evidence ?? null)),
            recommendation: JSON.parse(JSON.stringify(result.recommendation ?? null)),
            toolsUsed: JSON.parse(JSON.stringify(result.toolsUsed ?? [])),
            model: JSON.parse(JSON.stringify(result.model ?? null)),
          },
        },
      ],
    })

    return successResponse(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (code === 'NO_PRODUCTS' || code === 'NO_BRANCHES') {
      return errorResponse(409, code, 'No hay productos o sucursales activos para investigar')
    }
    throw error
  }
})
