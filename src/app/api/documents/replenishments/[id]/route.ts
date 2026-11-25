import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse } from '@/lib/api-utils'
import { getLatestDocument, readDocumentFile } from '@/services/document.service'

export const GET = withApiAuth<{ params: Promise<{ id: string }> }>(ALL_ROLES, async (_request, ctx) => {
  const { id } = await ctx!.params
  const document = await getLatestDocument('REPLENISHMENT', id)
  if (!document) return errorResponse(404, 'NOT_FOUND', 'No hay PDF para esta reposición')

  const contents = await readDocumentFile(document.storagePath)
  const body = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) as ArrayBuffer

  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${document.fileName}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
