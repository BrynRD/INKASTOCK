import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { SessionGuard } from '@/components/auth/session-guard'
import ReplenishmentActions from '@/components/replenishments/replenishment-actions'
import { requireUser } from '@/lib/auth/dal'
import { ALL_ROLES, APPROVAL_ROLES, INVENTORY_WRITE_ROLES } from '@/lib/auth/permissions'
import { getReplenishment } from '@/services/replenishment.service'

export default function ReplenishmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <SessionGuard roles={ALL_ROLES}>
      <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando reposición…</div>}>
        <ReplenishmentDetail params={params} />
      </Suspense>
    </SessionGuard>
  )
}

function formatEvidence(evidence: unknown) {
  if (!evidence || typeof evidence !== 'object') return 'Sin evidencia adicional'
  const record = evidence as Record<string, unknown>
  const fields = ['stock', 'minimumStock', 'targetStock', 'incomingTransfers', 'openRequests', 'projectedStock', 'suggestedQuantity']
  return fields
    .filter((field) => record[field] !== undefined)
    .map((field) => `${field}: ${String(record[field])}`)
    .join(' · ')
}

async function ReplenishmentDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const [user, replenishment] = await Promise.all([requireUser(), getReplenishment(id)])
  if (!replenishment) notFound()

  return (
    <div className="space-y-6">
      <Link href="/dashboard/replenishments" className="text-sm font-medium text-[#168447] hover:underline">
        ← Volver a reposiciones
      </Link>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{replenishment.code}</p>
            <h2 className="mt-1 text-2xl font-bold text-[#17211B]">Reposición inteligente</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {replenishment.product.name} · {replenishment.branch.name}
            </p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-[#E8F5ED] px-3 py-1 text-xs font-semibold text-[#168447]">
              {replenishment.status}
            </span>
            <p className="mt-2 text-xs text-[#64748B]">
              Solicitada {new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(replenishment.requestedAt)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-5">
          <a
            href={`/api/documents/replenishments/${replenishment.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#168447] px-3 py-1 text-sm font-semibold text-[#168447] hover:bg-[#E8F5ED]"
          >
            Ver PDF
          </a>
          <ReplenishmentActions
            id={replenishment.id}
            status={replenishment.status}
            canApprove={APPROVAL_ROLES.includes(user.role)}
            canReceive={INVENTORY_WRITE_ROLES.includes(user.role)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs uppercase text-[#64748B]">Solicitado</p>
          <p className="mt-2 text-2xl font-bold text-[#17211B]">{replenishment.requestedQuantity}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs uppercase text-[#64748B]">Recibido</p>
          <p className="mt-2 text-2xl font-bold text-[#17211B]">{replenishment.receivedQuantity}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs uppercase text-[#64748B]">Sugerencia del sistema</p>
          <p className="mt-2 text-2xl font-bold text-[#17211B]">
            {String((replenishment.evidence as { suggestedQuantity?: number } | null)?.suggestedQuantity ?? '—')}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#17211B]">Cálculo y evidencia</h3>
        <p className="mt-2 text-sm text-[#64748B]">{formatEvidence(replenishment.evidence)}</p>
        <p className="mt-3 text-xs text-[#94A3B8]">
          La aprobación no compra ni modifica inventario. El stock cambia solo al registrar la recepción física.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Stock actual</th>
              <th className="px-4 py-3">Mínimo</th>
              <th className="px-4 py-3">Objetivo</th>
              <th className="px-4 py-3">Solicitado</th>
              <th className="px-4 py-3">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {replenishment.items.map((item) => (
              <tr key={item.id} className="border-t border-[#E2E8F0]">
                <td className="px-4 py-3 font-medium text-[#17211B]">{replenishment.product.name}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.currentStock}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.minimumStock}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.targetStock}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.requestedQuantity}</td>
                <td className="px-4 py-3 text-[#64748B]">{item.receivedQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {replenishment.reason ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
          <p className="font-semibold text-[#17211B]">Motivo</p>
          <p className="mt-2">{replenishment.reason}</p>
        </div>
      ) : null}
    </div>
  )
}
