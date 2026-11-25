import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { SessionGuard } from '@/components/auth/session-guard'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/dal'
import { prisma } from '@/lib/prisma'
import type { ReplenishmentStatus, TransferStatus } from '@/generated/prisma/enums'

const PENDING_TRANSFER_STATUSES: TransferStatus[] = [
  'PENDING_ORIGIN_CONFIRMATION',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
]

const PENDING_REPLENISHMENT_STATUSES: ReplenishmentStatus[] = [
  'PENDING_APPROVAL',
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
]

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando bandeja…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <NotificationsContent />
      </SessionGuard>
    </Suspense>
  )
}

async function NotificationsContent() {
  await connection()
  await requireUser()

  const [transfers, replenishments] = await Promise.all([
    prisma.transfer.findMany({
      where: { status: { in: PENDING_TRANSFER_STATUSES } },
      include: { originBranch: true, destinationBranch: true, items: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.replenishment.findMany({
      where: { status: { in: PENDING_REPLENISHMENT_STATUSES } },
      include: { product: true, branch: true },
      orderBy: { requestedAt: 'asc' },
      take: 50,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Bandeja de trabajo</h2>
        <p className="text-sm text-[#64748B]">Operaciones que requieren confirmación, despacho o recepción.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <h3 className="text-sm font-semibold text-[#17211B]">Transferencias ({transfers.length})</h3>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {transfers.map((transfer) => (
              <Link key={transfer.id} href={`/dashboard/transfers/${transfer.id}`} className="block px-5 py-4 hover:bg-[#F8FAFC]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#168447]">{transfer.code}</p>
                  <span className="text-xs text-[#64748B]">{transfer.status}</span>
                </div>
                <p className="mt-1 text-sm text-[#64748B]">
                  {transfer.originBranch.name} → {transfer.destinationBranch.name}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  {transfer.items.length} producto(s)
                </p>
              </Link>
            ))}
            {transfers.length === 0 ? <p className="px-5 py-8 text-sm text-[#94A3B8]">Sin transferencias pendientes.</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <h3 className="text-sm font-semibold text-[#17211B]">Reposiciones ({replenishments.length})</h3>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {replenishments.map((replenishment) => (
              <Link key={replenishment.id} href={`/dashboard/replenishments/${replenishment.id}`} className="block px-5 py-4 hover:bg-[#F8FAFC]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#168447]">{replenishment.code}</p>
                  <span className="text-xs text-[#64748B]">{replenishment.status}</span>
                </div>
                <p className="mt-1 text-sm text-[#64748B]">
                  {replenishment.product.name} · {replenishment.branch.name}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Solicitado: {replenishment.requestedQuantity} · Recibido: {replenishment.receivedQuantity}
                </p>
              </Link>
            ))}
            {replenishments.length === 0 ? <p className="px-5 py-8 text-sm text-[#94A3B8]">Sin reposiciones pendientes.</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
