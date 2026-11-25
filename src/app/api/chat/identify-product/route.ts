import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { identifyProductImage } from '@/services/vision.service'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function detectImageMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export const POST = withApiAuth(ALL_ROLES, async (request) => {
  const form = await request.formData()
  const file = form.get('image')
  const question = String(form.get('question') ?? '¿Qué producto es?')

  if (!(file instanceof File)) {
    return errorResponse(400, 'IMAGE_REQUIRED', 'Adjunta una imagen JPG, PNG o WEBP')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return errorResponse(400, 'IMAGE_TOO_LARGE', 'La imagen debe pesar menos de 5 MB')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectImageMime(bytes)
  if (!mimeType) {
    return errorResponse(400, 'UNSUPPORTED_IMAGE_TYPE', 'Formato de imagen no soportado')
  }

  try {
    const result = await identifyProductImage({
      mimeType,
      base64: Buffer.from(bytes).toString('base64'),
      fileName: file.name,
    })
    return successResponse({ ...result, question })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (code === 'GROQ_NOT_CONFIGURED') {
      return errorResponse(503, code, 'La identificación por imagen requiere GROQ_API_KEY y GROQ_VISION_MODEL')
    }
    if (code.startsWith('GROQ_') || code === 'UNSUPPORTED_IMAGE_TYPE') {
      return errorResponse(502, code, 'No se pudo analizar la imagen')
    }
    throw error
  }
})
