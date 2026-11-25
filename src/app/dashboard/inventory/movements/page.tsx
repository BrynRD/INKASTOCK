import { Suspense } from 'react'
import { connection } from 'next/server'
import MovementForm from '@/components/inventory/movement-form'
import { listMovements } from '@/services/movement.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { requireUser } from '@/lib/auth/dal'
import { ALL_ROLES, INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'

export default function MovementsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando movimientos...
            </div>
          }
        >
          <MovementsContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function MovementsContent() {
  await connection()
  const user = await requireUser()
  const result = await listMovements({ page: 1, pageSize: 50 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Movimientos</h2>
        <p className="text-sm text-[#64748B]">Entradas, salidas FEFO y ajustes de inventario.</p>
      </div>

      {INVENTORY_WRITE_ROLES.includes(user.role) ? <MovementForm /> : null}

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((movement) => (
              <tr key={movement.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{movement.type}</td>
                <td className="px-4 py-3 text-[#64748B]">{movement.product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{movement.branch.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{movement.quantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{new Date(movement.createdAt).toLocaleString('es-PE')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
