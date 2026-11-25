import { Suspense } from 'react'
import { SessionGuard } from '@/components/auth/session-guard'
import { ADMIN_ONLY } from '@/lib/auth/permissions'

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ADMIN_ONLY}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando configuración...
            </div>
          }
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#17211B]">Configuración</h2>
              <p className="text-sm text-[#64748B]">Ajustes del sistema InkaStock.</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#64748B]">La configuración avanzada estará disponible en la siguiente fase.</p>
            </div>
          </div>
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}
