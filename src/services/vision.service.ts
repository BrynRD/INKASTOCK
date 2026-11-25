import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1'
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? 'qwen/qwen3.8-27b'

const optionalText = z.string().nullish().transform((value) => value?.trim() || undefined)

const visionSchema = z.object({
  detectedText: z.array(z.string()).nullish().transform((value) => value ?? []),
  productName: optionalText,
  brand: optionalText,
  sku: optionalText,
  barcode: optionalText,
  concentration: optionalText,
  presentation: optionalText,
  confidence: z.number().min(0).max(1).nullish().transform((value) => value ?? undefined),
  notes: optionalText,
})

export type VisionIdentification = z.infer<typeof visionSchema>

export type ProductCandidate = {
  productId: string
  sku: string
  name: string
  score: number
  reason: string
}

export async function identifyProductImage(input: {
  mimeType: string
  base64: string
  fileName?: string
}) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_NOT_CONFIGURED')

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(input.mimeType)) throw new Error('UNSUPPORTED_IMAGE_TYPE')

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Analiza la imagen de un producto farmacéutico y extrae solo datos visibles. Devuelve JSON con detectedText, productName, brand, sku, barcode, concentration, presentation, confidence y notes. No inventes datos. No estimues stock. Responde en español.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identifica el producto de la imagen. Si no puedes leer un campo, omítelo. La confianza debe ser entre 0 y 1.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${input.mimeType};base64,${input.base64}` },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  })

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'GROQ_VISION_ERROR')
  }

  const raw = payload.choices?.[0]?.message?.content
  if (!raw) throw new Error('GROQ_VISION_EMPTY_RESPONSE')

  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = visionSchema.parse(JSON.parse(jsonText))
  const candidates = await matchProductCandidates(parsed)

  return {
    extracted: parsed,
    candidates,
    model: VISION_MODEL,
    needsHumanReview: candidates.length !== 1 || (parsed.confidence ?? 0) < 0.7,
  }
}

async function matchProductCandidates(extracted: VisionIdentification): Promise<ProductCandidate[]> {
  const conditions: Array<Record<string, unknown>> = []

  if (extracted.sku) conditions.push({ sku: { equals: extracted.sku, mode: 'insensitive' } })
  if (extracted.barcode) conditions.push({ barcode: { equals: extracted.barcode, mode: 'insensitive' } })
  if (extracted.productName) {
    conditions.push({ name: { contains: extracted.productName, mode: 'insensitive' } })
  }
  if (extracted.brand) conditions.push({ name: { contains: extracted.brand, mode: 'insensitive' } })

  if (conditions.length === 0) return []

  const products = await prisma.product.findMany({
    where: { active: true, OR: conditions },
    take: 8,
  })

  const normalizedSku = extracted.sku?.trim().toLowerCase() ?? ''
  const normalizedBarcode = extracted.barcode?.trim().toLowerCase() ?? ''
  const normalizedName = extracted.productName?.trim().toLowerCase() ?? ''

  return products.map((product) => {
    const sku = product.sku.toLowerCase()
    const name = product.name.toLowerCase()
    const barcode = product.barcode?.toLowerCase() ?? ''

    let score = 40
    let reason = 'Coincidencia por nombre o marca'
    if (normalizedSku && sku === normalizedSku) {
      score = 100
      reason = 'SKU exacto'
    } else if (normalizedBarcode && barcode === normalizedBarcode) {
      score = 95
      reason = 'Código de barras exacto'
    } else if (normalizedName && name.includes(normalizedName)) {
      score = 75
      reason = 'Coincidencia parcial de nombre'
    }

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      score,
      reason,
    }
  }).sort((a, b) => b.score - a.score)
}
