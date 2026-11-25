import { Suspense } from 'react'
import ReportDownload from '@/components/reports/report-download'
import { SessionGuard } from '@/components/auth/session-guard'
import { REPORT_ROLES } from '@/lib/auth/permissions'

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={REPORT_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando reportes...
            </div>
          }
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#17211B]">Reportes</h2>
              <p className="text-sm text-[#64748B]">Exportación de alertas en formato CSV para análisis externo.</p>
            </div>
            <ReportDownload />
          </div>
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}
