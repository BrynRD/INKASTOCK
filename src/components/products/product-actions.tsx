'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProductActions({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDeactivate() {
    setLoading(true)
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (response.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDeactivate()}
      disabled={loading}
      className="rounded-lg border border-[#D92732] px-3 py-1 text-sm font-semibold text-[#D92732] transition-colors hover:bg-[#D92732] hover:text-white disabled:opacity-60"
    >
      {loading ? 'Desactivando...' : 'Desactivar'}
    </button>
  )
}
