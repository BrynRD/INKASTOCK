import { withApiAuth } from '@/lib/auth/api'
import { REPORT_ROLES } from '@/lib/auth/permissions'
import { generateAlertsReport } from '@/services/report.service'

export const GET = withApiAuth(REPORT_ROLES, async () => {
  const report = await generateAlertsReport()

  return new Response(report.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report.fileName}"`,
    },
  })
})
