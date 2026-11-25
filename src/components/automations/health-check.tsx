'use client'

import { useState } from 'react'

export default function HealthCheck() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCheck() {
    setLoading(true)
    try {
      const response = await fetch('/api/health')
      const json = await response.json()
      setStatus(`${json.status ?? 'unknown'} - ${json.application ?? 'InkaStock'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleCheck()}
        disabled={loading}
        className="rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-60"
      >
        {loading ? 'Consultando...' : 'Comprobar API'}
      </button>
      {status && <p className="text-sm text-[#168447]">{status}</p>}
    </div>
  )
}
