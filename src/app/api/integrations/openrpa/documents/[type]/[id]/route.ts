import { errorResponse, isOpenRpaAuthorized } from '@/lib/api-utils'
import { getLatestDocument, readDocumentFile } from '@/services/document.service'
import type { OperationDocumentType } from '@/services/document.service'

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string; id: string }> },
) {
  if (!isOpenRpaAuthorized(request)) return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')

  const { type, id } = await context.params
  if (type !== 'TRANSFER' && type !== 'REPLENISHMENT') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tipo de documento no válido')
  }

  const document = await getLatestDocument(type as OperationDocumentType, id)
  if (!document) return errorResponse(404, 'NOT_FOUND', 'Documento no encontrado')

  const contents = await readDocumentFile(document.storagePath)
  const body = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) as ArrayBuffer

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${document.fileName}.pdf"`,
    },
  })
}
