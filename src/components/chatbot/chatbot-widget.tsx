'use client'

import { useRef, useState } from 'react'
import { Bot, ImageIcon, Loader2, Send, X } from 'lucide-react'

type Candidate = {
  productId: string
  sku: string
  name: string
  score: number
  reason: string
}

type Recommendation = {
  type: 'TRANSFER' | 'REPLENISHMENT'
  payload: Record<string, unknown>
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  candidates?: Candidate[]
  recommendation?: Recommendation
}

type InvestigateResponse = {
  success: boolean
  data?: {
    answer: string
    recommendation?: Recommendation
    toolsUsed?: string[]
    model?: string
  }
  error?: { message?: string }
}

type IdentifyResponse = {
  success: boolean
  data?: {
    candidates: Candidate[]
    extracted?: { productName?: string; sku?: string; confidence?: number }
    needsHumanReview?: boolean
  }
  error?: { message?: string }
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hola, soy el investigador de inventario de InkaStock. Pregúntame por un producto o envíame una foto para identificar y evaluar reposición o transferencia.',
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function buildOperation(messageId: string, recommendation: Recommendation) {
  const payload = recommendation.payload
  if (recommendation.type === 'REPLENISHMENT') {
    if (!isString(payload.productId) || !isString(payload.branchId) || !isNumber(payload.requestedQuantity)) return null
    return {
      url: '/api/replenishments',
      body: {
        productId: payload.productId,
        branchId: payload.branchId,
        requestedQuantity: payload.requestedQuantity,
        reason: isString(payload.reason) ? payload.reason : 'Reposición creada desde el chatbot',
        idempotencyKey: `chat-rep-${messageId}`,
      },
    }
  }

  if (!isString(payload.originBranchId) || !isString(payload.destinationBranchId) || !Array.isArray(payload.items)) {
    return null
  }

  const items = payload.items
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      if (!isString(record.productId) || !isNumber(record.requestedQuantity)) return null
      return { productId: record.productId, requestedQuantity: record.requestedQuantity }
    })
    .filter((item): item is { productId: string; requestedQuantity: number } => item !== null)

  if (items.length === 0) return null

  return {
    url: '/api/transfers',
    body: {
      originBranchId: payload.originBranchId,
      destinationBranchId: payload.destinationBranchId,
      items,
      notes: isString(payload.reason) ? payload.reason : 'Transferencia creada desde el chatbot',
      idempotencyKey: `chat-trf-${messageId}`,
    },
  }
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedActions, setCompletedActions] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(0)

  function nextId(prefix: string) {
    idCounter.current += 1
    return `${prefix}-${idCounter.current}`
  }

  function append(message: ChatMessage) {
    setMessages((current) => [...current, message])
  }

  function replace(id: string, message: ChatMessage) {
    setMessages((current) => current.map((item) => (item.id === id ? message : item)))
  }

  async function investigate(prompt: string, productId?: string) {
    const assistantId = nextId('assistant')
    append({ id: nextId('user'), role: 'user', content: prompt })
    append({ id: assistantId, role: 'assistant', content: 'Investigando inventario…' })
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, ...(productId ? { productId } : {}) }),
      })
      const json = (await response.json()) as InvestigateResponse
      if (!response.ok || !json.data) {
        replace(assistantId, {
          id: assistantId,
          role: 'assistant',
          content: json.error?.message ?? 'No pude completar la investigación.',
        })
        return
      }
      replace(assistantId, {
        id: assistantId,
        role: 'assistant',
        content: json.data.answer,
        recommendation: json.data.recommendation,
      })
    } catch {
      replace(assistantId, {
        id: assistantId,
        role: 'assistant',
        content: 'No pude conectar con el investigador de inventario.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    const message = input.trim()
    if (!message || loading) return
    setInput('')
    await investigate(message)
  }

  async function handleImage(file: File) {
    if (loading) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Usa una imagen JPG, PNG o WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen debe pesar menos de 5 MB.')
      return
    }

    const assistantId = nextId('assistant')
    append({ id: nextId('user'), role: 'user', content: `📷 ${file.name}` })
    append({ id: assistantId, role: 'assistant', content: 'Analizando la imagen…' })
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('image', file)
    form.append('question', input.trim() || 'Identifica este producto y evalúa si necesita reposición o transferencia.')

    try {
      const response = await fetch('/api/chat/identify-product', { method: 'POST', body: form })
      const json = (await response.json()) as IdentifyResponse
      if (!response.ok || !json.data) {
        replace(assistantId, {
          id: assistantId,
          role: 'assistant',
          content: json.error?.message ?? 'No pude identificar el producto en la imagen.',
        })
        return
      }

      const { candidates, extracted } = json.data
      if (candidates.length === 0) {
        replace(assistantId, {
          id: assistantId,
          role: 'assistant',
          content: `No encontré un producto coincidente${extracted?.productName ? ` para “${extracted.productName}”` : ''}. Prueba con una foto más nítida o escribe el nombre.`,
        })
        return
      }

      replace(assistantId, {
        id: assistantId,
        role: 'assistant',
        content: candidates.length === 1
          ? `Identifiqué ${candidates[0].name} (SKU ${candidates[0].sku}). Selecciona el producto para investigar stock y opciones.`
          : `Encontré ${candidates.length} posibles coincidencias. Selecciona el producto correcto para continuar.`,
        candidates,
      })
    } catch {
      replace(assistantId, {
        id: assistantId,
        role: 'assistant',
        content: 'No pude analizar la imagen en este momento.',
      })
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function createOperation(message: ChatMessage) {
    if (!message.recommendation || actionLoading || completedActions[message.id]) return
    const operation = buildOperation(message.id, message.recommendation)
    if (!operation) {
      setError('La recomendación no tiene datos suficientes para crear la solicitud.')
      return
    }

    setActionLoading(message.id)
    setError(null)
    try {
      const response = await fetch(operation.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation.body),
      })
      const json = (await response.json()) as {
        success: boolean
        data?: { code?: string }
        message?: string
        error?: { message?: string }
      }
      if (!response.ok) {
        setError(json.error?.message ?? 'No se pudo crear la solicitud.')
        return
      }
      const code = json.data?.code ?? 'registrada'
      setCompletedActions((current) => ({ ...current, [message.id]: code }))
      append({
        id: nextId('assistant'),
        role: 'assistant',
        content: `Solicitud ${code} creada. Puedes revisarla en la bandeja. El inventario no cambia hasta la recepción.`,
      })
    } catch {
      setError('No se pudo crear la solicitud.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[34rem] w-[22rem] flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-[#168447] px-4 py-3 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4" />
              Investigador InkaStock
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/80 transition-colors hover:text-white"
              aria-label="Cerrar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className={`space-y-2 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'bg-[#168447] text-white' : 'bg-[#F1F5F9] text-[#17211B]'}`}
                >
                  {message.content}
                </div>

                {message.candidates && message.candidates.length > 0 ? (
                  <div className="space-y-1.5">
                    {message.candidates.map((candidate) => (
                      <button
                        key={candidate.productId}
                        type="button"
                        onClick={() => void investigate(`Analiza ${candidate.name} y recomienda si necesita reposición o transferencia.`, candidate.productId)}
                        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-left text-xs transition-colors hover:border-[#168447] hover:bg-[#F8FAFC]"
                      >
                        <span className="block font-semibold text-[#17211B]">{candidate.name}</span>
                        <span className="text-[#64748B]">SKU {candidate.sku} · {candidate.reason}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {message.recommendation ? (
                  <div className="space-y-1.5">
                    {completedActions[message.id] ? (
                      <p className="text-xs font-medium text-[#168447]">Solicitud creada: {completedActions[message.id]}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void createOperation(message)}
                        disabled={actionLoading === message.id}
                        className="rounded-lg bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0A2C42] disabled:opacity-50"
                      >
                        {actionLoading === message.id
                          ? 'Creando…'
                          : message.recommendation.type === 'TRANSFER'
                            ? 'Preparar transferencia'
                            : 'Preparar reposición'}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Procesando…
              </div>
            ) : null}
            {error ? <p className="text-xs text-[#D92732]">{error}</p> : null}
          </div>

          <div className="flex items-center gap-2 border-t border-[#E2E8F0] p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImage(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="rounded-lg border border-[#E2E8F0] p-2 text-[#64748B] transition-colors hover:border-[#168447] hover:text-[#168447] disabled:opacity-50"
              aria-label="Adjuntar imagen"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void sendMessage()
              }}
              placeholder="Pregunta o describe el caso…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#168447]"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading}
              className="rounded-lg bg-[#168447] p-2 text-white transition-colors hover:bg-[#116638] disabled:opacity-50"
              aria-label="Enviar mensaje"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#168447] text-white shadow-lg transition-colors hover:bg-[#116638]"
        aria-label="Abrir chat"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  )
}
