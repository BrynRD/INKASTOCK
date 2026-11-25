import { Suspense } from 'react'
import { connection } from 'next/server'
import { listLots } from '@/services/lot.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { ALL_ROLES } from '@/lib/auth/permissions'

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando inventario...
            </div>
          }
        >
          <InventoryContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function InventoryContent() {
  await connection()
  const result = await listLots({ branchId: undefined, productId: undefined, page: 1, pageSize: 50 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Inventario</h2>
        <p className="text-sm text-[#64748B]">Existencias disponibles por producto y sucursal.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((lot) => (
              <tr key={lot.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{lot.product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{lot.branchId}</td>
                <td className="px-4 py-3 text-[#64748B]">{lot.quantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{new Date(lot.expirationDate).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
