'use client'

import { useState } from 'react'

export default function TelegramLinkPanel() {
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateCode() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/telegram/link-code', { method: 'POST' })
      const json = (await response.json()) as {
        success: boolean
        data?: { code: string; expiresAt: string }
        error?: { message?: string }
      }
      if (!response.ok || !json.data) {
        setError(json.error?.message ?? 'No se pudo generar el código.')
        return
      }
      setCode(json.data.code)
      setExpiresAt(json.data.expiresAt)
    } catch {
      setError('No se pudo conectar con InkaStock.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[#17211B]">Vincular Telegram</h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Genera un código temporal y envíalo al bot de InkaStock con el comando <code className="rounded bg-[#F1F5F9] px-1">/vincular CODIGO</code>.
      </p>

      <button
        type="button"
        onClick={() => void generateCode()}
        disabled={loading}
        className="mt-4 rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#116638] disabled:opacity-50"
      >
        {loading ? 'Generando…' : 'Generar código'}
      </button>

      {code ? (
        <div className="mt-5 rounded-xl border border-[#168447]/20 bg-[#E8F5ED] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#168447]">Código de vinculación</p>
          <p className="mt-2 text-3xl font-bold tracking-[0.25em] text-[#17211B]">{code}</p>
          <p className="mt-2 text-sm text-[#64748B]">Envíalo así al bot: <strong>/vincular {code}</strong></p>
          {expiresAt ? (
            <p className="mt-1 text-xs text-[#64748B]">
              Vence {new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(expiresAt))}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[#D92732]">{error}</p> : null}
    </div>
  )
}
