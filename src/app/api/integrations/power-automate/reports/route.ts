import { errorResponse, isPowerAutomateAuthorized, successResponse } from '@/lib/api-utils'
import type { ReportFormat } from '@/lib/report-format'
import { generateReportExport } from '@/services/report-export.service'

export async function GET(request: Request) {
  if (!isPowerAutomateAuthorized(request)) {
    return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'both'

  const formats: ReportFormat[] =
    format === 'pdf' ? ['pdf'] : format === 'csv' ? ['csv'] : ['pdf', 'csv']

  const payload = await generateReportExport(formats)

  return successResponse(payload)
}
