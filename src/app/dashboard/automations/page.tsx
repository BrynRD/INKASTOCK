import { Suspense } from 'react'
import HealthCheck from '@/components/automations/health-check'
import { SessionGuard } from '@/components/auth/session-guard'
import { ADMIN_ONLY } from '@/lib/auth/permissions'

export default function AutomationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ADMIN_ONLY}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando automatizaciones...
            </div>
          }
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#17211B]">Automatizaciones</h2>
              <p className="text-sm text-[#64748B]">Integración con OpenRPA para ejecuciones programadas.</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#17211B]">Estado del servicio</h3>
              <p className="mt-1 text-sm text-[#64748B]">Verifica que la API esté disponible antes de ejecutar robots.</p>
              <div className="mt-4">
                <HealthCheck />
              </div>
            </div>
          </div>
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}
