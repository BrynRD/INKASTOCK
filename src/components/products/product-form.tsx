'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Branch = {
  id: string
  name: string
}

export default function ProductForm() {
  const router = useRouter()
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('unidad')
  const [initialQuantity, setInitialQuantity] = useState('')
  const [initialBranchId, setInitialBranchId] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/branches')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success && json.data?.data) {
          setBranches(json.data.data)
        } else if (json.success && Array.isArray(json.data)) {
          setBranches(json.data)
        } else {
          setError('No se pudieron cargar las sucursales.')
        }
        setBranchesLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudieron cargar las sucursales.')
        setBranchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    // Validar: si hay cantidad inicial, se requiere sucursal
    if (initialQuantity && Number(initialQuantity) > 0 && !initialBranchId) {
      setError('Si indicas cantidad inicial, debes seleccionar una sucursal.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          barcode: barcode || undefined,
          name,
          description: description || undefined,
          category,
          unit,
          active: true,
          ...(initialQuantity ? { initialQuantity: Number(initialQuantity) } : {}),
          ...(initialBranchId ? { initialBranchId } : {}),
          ...(expirationDate ? { expirationDate } : {}),
          ...(lotNumber ? { lotNumber } : {}),
        }),
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        setError(json.error?.message ?? 'No se pudo crear el producto.')
        return
      }

      setSku('')
      setBarcode('')
      setName('')
      setDescription('')
      setCategory('')
      setUnit('unidad')
      setInitialQuantity('')
      setInitialBranchId('')
      setExpirationDate('')
      setLotNumber('')
      router.refresh()
    } catch {
      setError('No se pudo crear el producto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[#17211B]">Crear producto</h3>
      {error && <p className="text-sm text-[#D92732]">{error}</p>}
      {branchesLoading && <p className="text-xs text-[#64748B]">Cargando sucursales…</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-[#17211B]">
          SKU *
          <input value={sku} onChange={(event) => setSku(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Código de barras
          <input value={barcode} onChange={(event) => setBarcode(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B] sm:col-span-2">
          Nombre *
          <input value={name} onChange={(event) => setName(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B] sm:col-span-2">
          Descripción
          <input value={description} onChange={(event) => setDescription(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Categoría *
          <input value={category} onChange={(event) => setCategory(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Unidad *
          <input value={unit} onChange={(event) => setUnit(event.target.value)} required className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Cantidad inicial
          <input
            type="number"
            value={initialQuantity}
            onChange={(event) => setInitialQuantity(event.target.value)}
            placeholder="0"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Sucursal inicial
          <select value={initialBranchId} onChange={(event) => setInitialBranchId(event.target.value)} className="rounded-lg border border-[#E2E8F0] px-3 py-2">
            <option value="">Seleccionar</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Vencimiento del lote
          <input
            type="date"
            value={expirationDate}
            onChange={(event) => setExpirationDate(event.target.value)}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#17211B]">
          Número de lote
          <input value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} placeholder="Opcional" className="rounded-lg border border-[#E2E8F0] px-3 py-2" />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading || branchesLoading}
        className="w-fit rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-60"
      >
        {loading ? 'Guardando…' : 'Crear producto'}
      </button>
    </form>
  )
}
