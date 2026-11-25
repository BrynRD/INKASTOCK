'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MovementForm() {
  const router = useRouter()
  const [productId, setProductId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [type, setType] = useState('ENTRY')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [lotId, setLotId] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          branchId,
          type,
          quantity: Number(quantity),
          reason: reason || undefined,
          lotId: type === 'ADJUSTMENT' ? lotId : undefined,
          lotNumber: type === 'ENTRY' && !lotId ? lotNumber : undefined,
          expirationDate: type === 'ENTRY' && !lotId ? expirationDate : undefined,
        }),
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        setError(json.error?.message ?? 'No se pudo registrar el movimiento.')
        return
      }

      setProductId('')
      setBranchId('')
      setQuantity('1')
      setReason('')
      setLotId('')
      setLotNumber('')
      setExpirationDate('')
      router.refresh()
    } catch {
      setError('No se pudo registrar el movimiento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[#17211B]">Registrar movimiento</h3>
      {error && <p className="text-sm text-[#D92732]">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-[#17211B]">
          Producto ID *
          <input value={productId} onChange={(event) => setProductId(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Sucursal ID *
          <input value={branchId} onChange={(event) => setBranchId(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Tipo *
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2">
            <option value="ENTRY">ENTRADA</option>
            <option value="EXIT">SALIDA</option>
            <option value="ADJUSTMENT">AJUSTE</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Cantidad *
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} required type="number" min={1} className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        {type === 'ADJUSTMENT' && (
          <label className="grid gap-1 text-sm text-[#17211B]">
            Lote ID *
            <input value={lotId} onChange={(event) => setLotId(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
          </label>
        )}
        {type === 'ENTRY' && (
          <>
            <label className="grid gap-1 text-sm text-[#17211B]">
              Lote ID existente
              <input value={lotId} onChange={(event) => setLotId(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
            </label>
            {!lotId && (
              <>
                <label className="grid gap-1 text-sm text-[#17211B]">
                  Número de lote *
                  <input value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm text-[#17211B]">
                  Vencimiento *
                  <input value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} required type="date" className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
                </label>
              </>
            )}
          </>
        )}
        <label className="grid gap-1 text-sm text-[#17211B] sm:col-span-2">
          Motivo
          <input value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-fit rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-60"
      >
        {loading ? 'Guardando...' : 'Registrar movimiento'}
      </button>
    </form>
  )
}
