import { errorResponse, isPowerAutomateAuthorized } from '@/lib/api-utils'
import { getOperationDocumentPdf, isOperationDocumentType } from '@/services/integration.service'

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string; id: string }> },
) {
  if (!isPowerAutomateAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const { type, id } = await context.params
  if (!isOperationDocumentType(type)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tipo de documento no válido')
  }

  const result = await getOperationDocumentPdf(type, id)
  if (!result) {
    return errorResponse(404, 'NOT_FOUND', 'Documento no encontrado')
  }

  return new Response(result.buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.document.fileName}.pdf"`,
    },
  })
}
