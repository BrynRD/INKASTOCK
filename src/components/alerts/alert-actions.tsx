'use client'

import { useState } from 'react'

export default function AlertActions({ id, status }: { id: string; status: string }) {
  const [loading, setLoading] = useState(false)

  async function handleResolve() {
    setLoading(true)
    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleAcknowledge() {
    setLoading(true)
    try {
      await fetch(`/api/alerts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      {status === 'PENDING' && (
        <button
          type="button"
          onClick={() => void handleAcknowledge()}
          disabled={loading}
          className="rounded-lg border border-[#F5C400] px-3 py-1 text-sm font-semibold text-[#B8860B] transition-colors hover:bg-[#F5C400] hover:text-white disabled:opacity-60"
        >
          {loading ? 'Procesando...' : 'Acknowledge'}
        </button>
      )}
      {status !== 'RESOLVED' && (
        <button
          type="button"
          onClick={() => void handleResolve()}
          disabled={loading}
          className="rounded-lg bg-[#168447] px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-60"
        >
          {loading ? 'Procesando...' : 'Resolver'}
        </button>
      )}
    </div>
  )
}
