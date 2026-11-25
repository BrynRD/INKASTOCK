import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import ReplenishmentActions from '@/components/replenishments/replenishment-actions'
import { listReplenishments } from '@/services/replenishment.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { requireUser } from '@/lib/auth/dal'
import { ALL_ROLES, APPROVAL_ROLES, INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'

export default function ReplenishmentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando reposiciones...
            </div>
          }
        >
          <ReplenishmentsContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function ReplenishmentsContent() {
  await connection()
  const user = await requireUser()
  const result = await listReplenishments({ page: 1, pageSize: 50 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Reposiciones</h2>
        <p className="text-sm text-[#64748B]">Solicitudes de reposición y su estado de aprobación.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Solicitado</th>
              <th className="px-4 py-3">Recibido</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((item) => (
              <tr key={item.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/replenishments/${item.id}`} className="font-semibold text-[#168447] hover:underline">
                    {item.code}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium text-[#17211B]">{item.product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.branch.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.requestedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.receivedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.status}</td>
                <td className="px-4 py-3">
                  <ReplenishmentActions
                    id={item.id}
                    status={item.status}
                    canApprove={APPROVAL_ROLES.includes(user.role)}
                    canReceive={INVENTORY_WRITE_ROLES.includes(user.role)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
