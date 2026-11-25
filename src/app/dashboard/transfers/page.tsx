import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { SessionGuard } from '@/components/auth/session-guard'
import TransferActions, { type TransferActionItem } from '@/components/transfers/transfer-actions'
import { requireUser } from '@/lib/auth/dal'
import { ALL_ROLES, APPROVAL_ROLES, INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { listTransfers } from '@/services/transfer.service'

export default function TransfersPage() {
  return (
    <SessionGuard roles={ALL_ROLES}>
      <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando transferencias…</div>}>
        <TransfersContent />
      </Suspense>
    </SessionGuard>
  )
}

async function TransfersContent() {
  await connection()
  const user = await requireUser()
  const result = await listTransfers({ page: 1, pageSize: 100 })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Transferencias</h2>
        <p className="text-sm text-[#64748B]">
          Redistribución entre sucursales. El inventario se ajusta solo al recepcionar.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Origen → Destino</th>
              <th className="px-4 py-3">Productos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((transfer) => {
              const items: TransferActionItem[] = transfer.items.map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                requestedQuantity: item.requestedQuantity,
                approvedQuantity: item.approvedQuantity,
                dispatchedQuantity: item.dispatchedQuantity,
                receivedQuantity: item.receivedQuantity,
              }))
              return (
                <tr key={transfer.id} className="border-t border-[#E2E8F0]">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/transfers/${transfer.id}`} className="font-semibold text-[#168447] hover:underline">
                      {transfer.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {transfer.originBranch.name} → {transfer.destinationBranch.name}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {transfer.items.map((item) => `${item.product.name} (${item.requestedQuantity})`).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{transfer.status}</td>
                  <td className="px-4 py-3">
                    <TransferActions
                      id={transfer.id}
                      status={transfer.status}
                      items={items}
                      canApprove={APPROVAL_ROLES.includes(user.role)}
                      canWrite={INVENTORY_WRITE_ROLES.includes(user.role)}
                    />
                  </td>
                </tr>
              )
            })}
            {result.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                  No hay transferencias registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
