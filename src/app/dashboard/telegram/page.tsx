import { Suspense } from 'react'
import { SessionGuard } from '@/components/auth/session-guard'
import TelegramLinkPanel from '@/components/telegram/telegram-link-panel'
import { ALL_ROLES } from '@/lib/auth/permissions'

export default function TelegramPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando Telegram…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#17211B]">Telegram</h2>
            <p className="text-sm text-[#64748B]">
              Aprobaciones rápidas con identidad vinculada. El chat debe estar autorizado por el administrador.
            </p>
          </div>

          <TelegramLinkPanel />

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-[#17211B]">Qué puedes hacer</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B]">
              <li>Recibir solicitudes de transferencia y reposición con PDF adjunto.</li>
              <li>Confirmar origen, despachar, aprobar o rechazar con botones.</li>
              <li>Todo movimiento de stock se registra en el dashboard, no en Telegram.</li>
            </ul>
          </div>
        </div>
      </SessionGuard>
    </Suspense>
  )
}
