'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type TransferActionItem = {
  productId: string
  productName: string
  requestedQuantity: number
  approvedQuantity: number
  dispatchedQuantity: number
  receivedQuantity: number
}

type Action = 'AUTHORIZE' | 'CONFIRM' | 'DISPATCH' | 'RECEIVE' | 'REJECT'

export default function TransferActions({
  id,
  status,
  items,
  canApprove,
  canWrite,
}: {
  id: string
  status: string
  items: TransferActionItem[]
  canApprove: boolean
  canWrite: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: Action) {
    setError(null)
    setLoading(action)

    const endpoints: Record<Action, string> = {
      AUTHORIZE: `/api/transfers/${id}/authorize`,
      CONFIRM: `/api/transfers/${id}/origin-confirm`,
      DISPATCH: `/api/transfers/${id}/dispatch`,
      RECEIVE: `/api/transfers/${id}/receive`,
      REJECT: `/api/transfers/${id}/reject`,
    }

    const body: Record<string, unknown> = {}
    if (action === 'CONFIRM') {
      body.items = items.map((item) => ({
        productId: item.productId,
        approvedQuantity: item.approvedQuantity || item.requestedQuantity,
      }))
    }
    if (action === 'RECEIVE') {
      body.items = items
        .map((item) => ({
          productId: item.productId,
          receivedQuantity: item.dispatchedQuantity - item.receivedQuantity,
        }))
        .filter((item) => item.receivedQuantity > 0)
    }
    if (action === 'REJECT') body.reason = 'Rechazada desde el dashboard'

    const response = await fetch(endpoints[action], {
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

  if (!canApprove && !canWrite) {
    return <span className="text-xs text-[#94A3B8]">Solo lectura</span>
  }

  const buttons: Array<{ action: Action; label: string; visible: boolean; tone: string }> = [
    {
      action: 'AUTHORIZE',
      label: 'Autorizar',
      visible: canApprove && ['DRAFT', 'PENDING_ORIGIN_CONFIRMATION'].includes(status),
      tone: 'bg-[#168447] text-white hover:bg-[#116638]',
    },
    {
      action: 'CONFIRM',
      label: 'Confirmar origen',
      visible: canWrite && status === 'PENDING_ORIGIN_CONFIRMATION',
      tone: 'bg-[#168447] text-white hover:bg-[#116638]',
    },
    {
      action: 'DISPATCH',
      label: 'Despachar',
      visible: canWrite && status === 'APPROVED',
      tone: 'bg-[#0F3D5C] text-white hover:bg-[#0A2C42]',
    },
    {
      action: 'RECEIVE',
      label: 'Recibir',
      visible: canWrite && ['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(status),
      tone: 'border border-[#F5C400] text-[#B8860B] hover:bg-[#F5C400] hover:text-white',
    },
    {
      action: 'REJECT',
      label: 'Rechazar',
      visible: canWrite && !['RECEIVED', 'REJECTED', 'CANCELLED'].includes(status),
      tone: 'border border-[#D92732] text-[#D92732] hover:bg-[#D92732] hover:text-white',
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {buttons.filter((button) => button.visible).map((button) => (
          <button
            key={button.action}
            type="button"
            disabled={loading !== null}
            onClick={() => void run(button.action)}
            className={`rounded-lg px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50 ${button.tone}`}
          >
            {loading === button.action ? 'Procesando…' : button.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-[#D92732]">{error}</p> : null}
    </div>
  )
}
