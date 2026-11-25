import { Suspense } from 'react'
import { connection } from 'next/server'
import AlertActions from '@/components/alerts/alert-actions'
import { listAlerts } from '@/services/alert.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { ALL_ROLES } from '@/lib/auth/permissions'

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando alertas...
            </div>
          }
        >
          <AlertsContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function AlertsContent() {
  await connection()
  const result = await listAlerts({ page: 1, pageSize: 50 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Alertas</h2>
        <p className="text-sm text-[#64748B]">Eventos de stock y vencimientos detectados desde el inventario.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Prioridad</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Mensaje</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((alert) => (
              <tr key={alert.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{alert.type}</td>
                <td className="px-4 py-3 text-[#64748B]">{alert.priority}</td>
                <td className="px-4 py-3 text-[#64748B]">{alert.product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{alert.message}</td>
                <td className="px-4 py-3 text-[#64748B]">{alert.status}</td>
                <td className="px-4 py-3">
                  <AlertActions id={alert.id} status={alert.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
