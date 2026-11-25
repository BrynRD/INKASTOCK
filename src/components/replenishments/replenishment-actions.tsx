'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = 'AUTHORIZE' | 'APPROVE' | 'REJECT' | 'RECEIVE'

export default function ReplenishmentActions({
  id,
  status,
  canApprove,
  canReceive,
}: {
  id: string
  status: string
  canApprove: boolean
  canReceive: boolean
}) {
  const router = useRouter()
  const [expirationDate, setExpirationDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<Action | null>(null)

  async function handleAction(action: Action) {
    setError(null)
    setLoading(action)
    let url = `/api/replenishments/${id}/authorize`
    let body: Record<string, unknown> = {}

    if (action === 'APPROVE') url = `/api/replenishments/${id}/approve`
    if (action === 'REJECT') url = `/api/replenishments/${id}/reject`
    if (action === 'RECEIVE') {
      url = `/api/replenishments/${id}/receive`
      if (!expirationDate) {
        setError('Indica la fecha de vencimiento del lote.')
        setLoading(null)
        return
      }
      body = { expirationDate }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setLoading(null)

    if (response.ok) {
      router.refresh()
      return
    }

    const json = (await response.json()) as { error?: { message?: string } }
    setError(json.error?.message ?? 'No se pudo completar la acción.')
  }

  const canAuthorize = canApprove && ['PENDING_APPROVAL', 'PENDING'].includes(status)
  const canReview = canApprove && ['REQUESTED', 'UNDER_REVIEW'].includes(status)
  const canReceiveNow = canReceive && ['REQUESTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(status)
  const canReject = canApprove && !['RECEIVED', 'REJECTED', 'CANCELLED'].includes(status)

  if (!canAuthorize && !canReview && !canReceiveNow) {
    return <span className="text-xs text-[#94A3B8]">Sin acciones pendientes</span>
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canAuthorize ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void handleAction('AUTHORIZE')}
            className="rounded-lg bg-[#168447] px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-50"
          >
            Autorizar
          </button>
        ) : null}
        {canReview ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void handleAction('APPROVE')}
            className="rounded-lg bg-[#168447] px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-50"
          >
            Aprobar
          </button>
        ) : null}
        {canReject ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void handleAction('REJECT')}
            className="rounded-lg border border-[#D92732] px-3 py-1 text-sm font-semibold text-[#D92732] transition-colors hover:bg-[#D92732] hover:text-white disabled:opacity-50"
          >
            Rechazar
          </button>
        ) : null}
        {canReceiveNow ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void handleAction('RECEIVE')}
            className="rounded-lg border border-[#F5C400] px-3 py-1 text-sm font-semibold text-[#B8860B] transition-colors hover:bg-[#F5C400] hover:text-white disabled:opacity-50"
          >
            Recibir
          </button>
        ) : null}
      </div>
      {canReceiveNow ? (
        <input
          type="date"
          value={expirationDate}
          onChange={(event) => setExpirationDate(event.target.value)}
          aria-label="Vencimiento del lote recibido"
          className="w-40 rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs"
        />
      ) : null}
      {error ? <p className="text-xs text-[#D92732]">{error}</p> : null}
    </div>
  )
}
