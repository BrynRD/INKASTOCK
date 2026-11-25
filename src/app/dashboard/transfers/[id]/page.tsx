import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { SessionGuard } from '@/components/auth/session-guard'
import TransferActions, { type TransferActionItem } from '@/components/transfers/transfer-actions'
import { requireUser } from '@/lib/auth/dal'
import { ALL_ROLES, APPROVAL_ROLES, INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { getTransfer } from '@/services/transfer.service'

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <SessionGuard roles={ALL_ROLES}>
      <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando transferencia…</div>}>
        <TransferDetail params={params} />
      </Suspense>
    </SessionGuard>
  )
}

async function TransferDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const [user, transfer] = await Promise.all([requireUser(), getTransfer(id)])
  if (!transfer) notFound()

  const items: TransferActionItem[] = transfer.items.map((item) => ({
    productId: item.productId,
    productName: item.product.name,
    requestedQuantity: item.requestedQuantity,
    approvedQuantity: item.approvedQuantity,
    dispatchedQuantity: item.dispatchedQuantity,
    receivedQuantity: item.receivedQuantity,
  }))

  return (
    <div className="space-y-6">
      <Link href="/dashboard/transfers" className="text-sm font-medium text-[#168447] hover:underline">
        ← Volver a transferencias
      </Link>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{transfer.code}</p>
            <h2 className="mt-1 text-2xl font-bold text-[#17211B]">Transferencia entre sucursales</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {transfer.originBranch.name} → {transfer.destinationBranch.name}
            </p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-[#E8F5ED] px-3 py-1 text-xs font-semibold text-[#168447]">
              {transfer.status}
            </span>
            <p className="mt-2 text-xs text-[#64748B]">
              Creada {new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(transfer.createdAt)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-5">
          <a
            href={`/api/documents/transfers/${transfer.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#168447] px-3 py-1 text-sm font-semibold text-[#168447] hover:bg-[#E8F5ED]"
          >
            Ver PDF
          </a>
          <TransferActions
            id={transfer.id}
            status={transfer.status}
            items={items}
            canApprove={APPROVAL_ROLES.includes(user.role)}
            canWrite={INVENTORY_WRITE_ROLES.includes(user.role)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Solicitado</th>
              <th className="px-4 py-3">Aprobado</th>
              <th className="px-4 py-3">Despachado</th>
              <th className="px-4 py-3">Recibido</th>
              <th className="px-4 py-3">Lotes</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item) => (
              <tr key={item.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{item.product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.requestedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.approvedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.dispatchedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.receivedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">
                  {item.lots.length === 0
                    ? 'Sin asignar'
                    : item.lots.map((lot) => `${lot.inventoryLot.lotNumber}: ${lot.plannedQuantity}`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transfer.notes ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
          <p className="font-semibold text-[#17211B]">Observaciones</p>
          <p className="mt-2">{transfer.notes}</p>
        </div>
      ) : null}
    </div>
  )
}
