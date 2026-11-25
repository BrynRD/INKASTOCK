'use client'

import { useState } from 'react'

export default function ReportDownload() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/reports')
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `InkaStock_Alerts_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
      } else {
        const json = await response.json()
        setError(json.error?.message ?? 'No se pudo generar el reporte.')
      }
    } catch {
      setError('No se pudo generar el reporte.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={loading}
        className="rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-60"
      >
        {loading ? 'Generando...' : 'Descargar reporte CSV'}
      </button>
      {error && <p className="text-sm text-[#D92732]">{error}</p>}
    </div>
  )
}
