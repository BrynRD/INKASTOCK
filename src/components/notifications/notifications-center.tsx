'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftRight,
  Bell,
  FileText,
  Package,
  RefreshCw,
  XCircle,
} from 'lucide-react'

type Operation = {
  id: string
  code: string
  type: 'TRANSFER' | 'REPLENISHMENT'
  status: string
  product: string
  sku?: string | null
  unit?: string | null
  branch?: string | null
  originBranch?: string | null
  destinationBranch?: string | null
  originBranchId?: string | null
  destinationBranchId?: string | null
  quantity: number
  suggestedQuantity?: number | null
  currentStock?: number | null
  minimumStock?: number | null
  targetStock?: number | null
  requestedBy?: { id?: string; name?: string; email?: string; role?: string } | null
  requestedAt: string
  reason?: string | null
  priority: string
  link: string
}

type Detail = {
  status?: string | null
  notes?: string | null
  evidence?: unknown
  items?: unknown
  settings?: unknown
  originBranch?: { name?: string } | null
  destinationBranch?: { name?: string } | null
  product?: { name?: string; sku?: string } | null
  branch?: { name?: string } | null
  requestedBy?: { name?: string; email?: string } | null
}

type Notification = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

type TransferItem = {
  id: string
  requestedQuantity: number
  approvedQuantity: number
  dispatchedQuantity: number
  receivedQuantity: number
  product: { name: string; sku: string } | null
  lots: Array<{ inventoryLot: { lotNumber: string; expirationDate: string } | null }> | null
}

type ReplenishmentItem = {
  id: string
  currentStock: number
  minimumStock: number
  targetStock: number
  requestedQuantity: number
}

type Tab = 'all' | 'pending' | 'review' | 'approved' | 'rejected' | 'history'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'review', label: 'En revisión' },
  { key: 'approved', label: 'Aprobadas' },
  { key: 'rejected', label: 'Rechazadas' },
  { key: 'history', label: 'Historial' },
]

const RESOLVED_STATUSES = ['RECEIVED', 'REJECTED', 'CANCELLED']

export default function NotificationsCenter() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [viewerRole, setViewerRole] = useState<string>('')
  const [operations, setOperations] = useState<Operation[]>([])
  const [, setNotifications] = useState<Notification[]>([])
  const [, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('pending')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [fromFilter, setFromFilter] = useState<string>('')
  const [toFilter, setToFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [selected, setSelected] = useState<Operation | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<{ id: string; action: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirming, setConfirming] = useState<{ id: string; action: string } | null>(null)
  const [expirationDate, setExpirationDate] = useState('')

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab, limit: '100' })
      const res = await fetch(`/api/approvals/queue?${params.toString()}`)
      if (!res.ok) throw new Error('No se pudo cargar la cola de aprobaciones')
      const json = await res.json()
      setViewerRole(json.data?.viewerRole ?? '')
      setOperations(json.data?.operations ?? [])
    } catch {
      setOperations([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unreadOnly=true&limit=10')
      if (res.ok) {
        const json = await res.json()
        setNotifications(json.data ?? [])
      }
      const countRes = await fetch('/api/notifications/unread-count')
      if (countRes.ok) {
        const json = await countRes.json()
        setUnreadCount(Number(json.data?.count ?? 0))
      }
    } catch {}
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadQueue()
    loadNotifications()
    pollRef.current = setInterval(() => {
      loadQueue()
      loadNotifications()
    }, 30000)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadQueue, loadNotifications])

  const branches = Array.from(
    new Set(
      operations.flatMap((op) =>
        [op.branch, op.originBranch, op.destinationBranch].filter(Boolean) as string[],
      ),
    ),
  ).sort()

  const filtered = operations.filter((op) => {
    if (typeFilter === 'transfer' && op.type !== 'TRANSFER') return false
    if (typeFilter === 'replenishment' && op.type !== 'REPLENISHMENT') return false
    if (branchFilter !== 'all') {
      const branchesOp = [op.branch, op.originBranch, op.destinationBranch].filter(Boolean)
      if (!branchesOp.includes(branchFilter)) return false
    }
    if (fromFilter && new Date(op.requestedAt) < new Date(fromFilter)) return false
    if (toFilter && new Date(op.requestedAt) > new Date(toFilter)) return false
    if (searchFilter) {
      const q = searchFilter.toLowerCase()
      if (
        ![op.code, op.product, op.branch, op.originBranch, op.destinationBranch, op.reason ?? '']
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
        return false
    }
    return true
  })

  const statusCounts = {
    all: operations.length,
    pending: operations.filter((o) => !RESOLVED_STATUSES.includes(o.status)).length,
    review: operations.filter((o) => o.status === 'UNDER_REVIEW' || o.status === 'PENDING_ORIGIN_CONFIRMATION').length,
    approved: operations.filter((o) => o.status === 'APPROVED' || o.status === 'REQUESTED' || o.status === 'ORDERED').length,
    rejected: operations.filter((o) => o.status === 'REJECTED').length,
    history: operations.filter((o) => RESOLVED_STATUSES.includes(o.status)).length,
  } as Record<Tab, number>

  const canApprove = viewerRole === 'ADMIN' || viewerRole === 'SUPERVISOR'
  const canWrite =
    viewerRole === 'ADMIN' || viewerRole === 'SUPERVISOR' || viewerRole === 'INVENTORY_MANAGER'

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
      )
    } catch {
      return value
    }
  }

  const priorityColor = (priority: string) => {
    if (priority === 'HIGH') return 'bg-[#D92732] text-white'
    if (priority === 'MEDIUM') return 'border border-[#F5C400] text-[#B8860B]'
    return 'border border-[#168447] text-[#168447]'
  }

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      PENDING_ORIGIN_CONFIRMATION: 'Pendiente confirmación origen',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      IN_TRANSIT: 'En tránsito',
      PARTIALLY_RECEIVED: 'Recepción parcial',
      RECEIVED: 'Recepcionada',
      CANCELLED: 'Cancelada',
      PENDING_APPROVAL: 'Pendiente de aprobación',
      REQUESTED: 'Solicitada',
      UNDER_REVIEW: 'En revisión',
      ORDERED: 'Ordenada',
    }
    return labels[status] ?? status
  }

  const handleMarkAllRead = async () => {
    setError(null)
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      if (!res.ok) throw new Error('No se pudo marcar como leídas')
      await loadNotifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar como leídas')
    }
  }

  const endpointFor = (operation: Operation, action: string) => {
    if (operation.type === 'TRANSFER') {
      const map: Record<string, string> = {
        AUTHORIZE: `/api/transfers/${operation.id}/authorize`,
        CONFIRM: `/api/transfers/${operation.id}/origin-confirm`,
        DISPATCH: `/api/transfers/${operation.id}/dispatch`,
        RECEIVE: `/api/transfers/${operation.id}/receive`,
        REJECT: `/api/transfers/${operation.id}/reject`,
      }
      return map[action]
    }
    const map: Record<string, string> = {
      AUTHORIZE: `/api/replenishments/${operation.id}/authorize`,
      APPROVE: `/api/replenishments/${operation.id}/approve`,
      REJECT: `/api/replenishments/${operation.id}/reject`,
      RECEIVE: `/api/replenishments/${operation.id}/receive`,
    }
    return map[action]
  }

  const runAction = useCallback(
    async (operation: Operation, action: string, body?: Record<string, unknown>) => {
      setError(null)
      const url = endpointFor(operation, action)
      if (!url) return
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error?.message ?? 'No se pudo completar la acción')
        }
        await loadQueue()
        await loadNotifications()
        setSelected(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo completar la acción')
      }
    },
    [loadQueue, loadNotifications],
  )

  const handleAction = (operation: Operation, action: string) => {
    if (action === 'REJECT') {
      setRejecting({ id: operation.id, action })
      setRejectReason('')
      return
    }
    if (action === 'APPROVE' || action === 'AUTHORIZE') {
      setConfirming({ id: operation.id, action })
      return
    }
    if (action === 'RECEIVE' && operation.type === 'REPLENISHMENT') {
      setExpirationDate('')
    }
    void runAction(operation, action)
  }

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      setError('El motivo del rechazo es obligatorio')
      return
    }
    if (!rejecting) return
    const operation = operations.find((o) => o.id === rejecting.id)
    if (!operation) return
    setRejecting(null)
    await runAction(operation, rejecting.action, { reason: rejectReason })
    setRejectReason('')
  }

  const submitConfirm = async () => {
    if (!confirming) return
    const operation = operations.find((o) => o.id === confirming.id)
    if (!operation) return
    setConfirming(null)
    await runAction(operation, confirming.action)
  }

  const loadDetail = async (operation: Operation) => {
    setDetailLoading(true)
    setError(null)
    try {
      const url =
        operation.type === 'TRANSFER'
          ? `/api/transfers/${operation.id}`
          : `/api/replenishments/${operation.id}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('No se pudo cargar el detalle')
      const json = await res.json()
      setDetail(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle')
    } finally {
      setDetailLoading(false)
    }
  }

  const openDetail = (operation: Operation) => {
    setSelected(operation)
    setDetail(null)
    void loadDetail(operation)
  }

  const closeDetail = () => {
    setSelected(null)
    setDetail(null)
    setError(null)
    setRejecting(null)
    setConfirming(null)
    setRejectReason('')
    setExpirationDate('')
  }

  const detailTransferItems = (detail?.items as TransferItem[] | undefined) ?? []
  const detailReplenishmentItems = (detail?.items as ReplenishmentItem[] | undefined) ?? []
  const detailSetting = (detail?.settings as Array<{ minimumStock?: number; targetStock?: number }> | undefined)?.[0]

  const detailActions = () => {
    if (!selected || !detail) return null
    const status = detail.status ?? selected.status
    const buttons: Array<{ label: string; action: string; tone: string; disabled: boolean }> = []
    const isTransfer = selected.type === 'TRANSFER'

    if (isTransfer) {
      if (canApprove && ['DRAFT', 'PENDING_ORIGIN_CONFIRMATION'].includes(status)) {
        buttons.push({ label: 'Autorizar', action: 'AUTHORIZE', tone: 'bg-[#168447] text-white hover:bg-[#116638]', disabled: detailLoading !== null })
      }
      if (canWrite && status === 'PENDING_ORIGIN_CONFIRMATION') {
        buttons.push({ label: 'Confirmar origen', action: 'CONFIRM', tone: 'bg-[#168447] text-white hover:bg-[#116638]', disabled: detailLoading !== null })
      }
      if (canWrite && status === 'APPROVED') {
        buttons.push({ label: 'Despachar', action: 'DISPATCH', tone: 'bg-[#0F3D5C] text-white hover:bg-[#0A2C42]', disabled: detailLoading !== null })
      }
      if (canWrite && ['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(status)) {
        buttons.push({ label: 'Recibir', action: 'RECEIVE', tone: 'border border-[#F5C400] text-[#B8860B] hover:bg-[#F5C400] hover:text-white', disabled: detailLoading !== null })
      }
      if (canApprove && !RESOLVED_STATUSES.includes(status)) {
        buttons.push({ label: 'Rechazar', action: 'REJECT', tone: 'border border-[#D92732] text-[#D92732] hover:bg-[#D92732] hover:text-white', disabled: detailLoading !== null })
      }
    } else {
      if (canApprove && ['PENDING_APPROVAL', 'PENDING'].includes(status)) {
        buttons.push({ label: 'Autorizar', action: 'AUTHORIZE', tone: 'bg-[#168447] text-white hover:bg-[#116638]', disabled: detailLoading !== null })
      }
      if (canApprove && ['REQUESTED', 'UNDER_REVIEW'].includes(status)) {
        buttons.push({ label: 'Aprobar', action: 'APPROVE', tone: 'bg-[#168447] text-white hover:bg-[#116638]', disabled: detailLoading !== null })
      }
      if (canWrite && ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(status)) {
        buttons.push({ label: 'Recibir', action: 'RECEIVE', tone: 'border border-[#F5C400] text-[#B8860B] hover:bg-[#F5C400] hover:text-white', disabled: detailLoading !== null })
      }
      if (canApprove && !RESOLVED_STATUSES.includes(status)) {
        buttons.push({ label: 'Rechazar', action: 'REJECT', tone: 'border border-[#D92732] text-[#D92732] hover:bg-[#D92732] hover:text-white', disabled: detailLoading !== null })
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map((button) => (
            <button key={button.action} type="button" disabled={button.disabled} onClick={() => handleAction(selected!, button.action)} className={`rounded-lg px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50 ${button.tone}`}>
              {button.disabled ? 'Procesando…' : button.label}
            </button>
          ))}
        </div>
        {selected.type === 'REPLENISHMENT' && canWrite && ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(detail.status ?? selected.status) ? (
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#64748B]">Vencimiento del lote recibido</label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              disabled={detailLoading !== null}
              className="w-48 rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs disabled:opacity-50"
            />
            <button
              type="button"
              disabled={detailLoading !== null || !expirationDate}
              onClick={() => void runAction(selected!, 'RECEIVE', { expirationDate })}
              className="ml-2 rounded-lg bg-[#168447] px-3 py-1 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#116638]"
            >
              Recibir
            </button>
          </div>
        ) : null}
        {error ? <p className="text-xs text-[#D92732]">{error}</p> : null}
      </div>
    )
  }

  const rowActions = (op: Operation) => {
    const status = op.status
    const buttons: Array<{ label: string; action: string; tone: string }> = []
    if (op.type === 'TRANSFER') {
      if (canApprove && ['DRAFT', 'PENDING_ORIGIN_CONFIRMATION'].includes(status)) {
        buttons.push({ label: 'Autorizar', action: 'AUTHORIZE', tone: 'bg-[#168447] text-white text-xs px-2 py-1 hover:bg-[#116638]' })
      }
      if (canApprove && !RESOLVED_STATUSES.includes(status)) {
        buttons.push({ label: 'Rechazar', action: 'REJECT', tone: 'border border-[#D92732] text-[#D92732] text-xs px-2 py-1 hover:bg-[#D92732] hover:text-white' })
      }
    } else {
      if (canApprove && ['PENDING_APPROVAL', 'PENDING'].includes(status)) {
        buttons.push({ label: 'Autorizar', action: 'AUTHORIZE', tone: 'bg-[#168447] text-white text-xs px-2 py-1 hover:bg-[#116638]' })
      }
      if (canApprove && ['REQUESTED', 'UNDER_REVIEW'].includes(status)) {
        buttons.push({ label: 'Aprobar', action: 'APPROVE', tone: 'bg-[#168447] text-white text-xs px-2 py-1 hover:bg-[#116638]' })
      }
      if (canApprove && !RESOLVED_STATUSES.includes(status)) {
        buttons.push({ label: 'Rechazar', action: 'REJECT', tone: 'border border-[#D92732] text-[#D92732] text-xs px-2 py-1 hover:bg-[#D92732] hover:text-white' })
      }
    }
    buttons.push({ label: 'Detalle', action: 'DETAIL', tone: 'text-[#168447] text-xs underline hover:text-[#116638]' })
    return buttons
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#17211B] flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#168447]" />
            Centro de notificaciones y aprobaciones
          </h2>
          <p className="text-sm text-[#64748B]">
            Solicitudes de transferencia, reposición y recepción. Los estados se sincronizan con Telegram.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleMarkAllRead}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] disabled:opacity-50 hover:bg-[#F8FAFC]"
          >
            Marcar todo como leído
          </button>
          <a
            href="/dashboard/telegram"
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#168447] hover:bg-[#F8FAFC]"
          >
            Configurar Telegram
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-6">
        {[
          { label: 'Pendientes', value: statusCounts.pending, tone: 'border-[#F5C400] text-[#B8860B]' },
          { label: 'En revisión', value: statusCounts.review, tone: 'border-[#0F3D5C] text-[#0F3D5C]' },
          { label: 'Aprobadas', value: statusCounts.approved, tone: 'border-[#168447] text-[#168447]' },
          { label: 'Rechazadas', value: statusCounts.rejected, tone: 'border-[#D92732] text-[#D92732]' },
          { label: 'Historial', value: statusCounts.history, tone: 'border-[#94A3B8] text-[#64748B]' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#17211B]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] px-5 py-4 flex flex-col lg:flex-row gap-3 items-center">
          <div className="flex gap-2">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === item.key
                    ? 'bg-[#168447] text-white'
                    : 'text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                {item.label} {statusCounts[item.key] > 0 ? <span className="ml-1 text-xs bg-white/80 text-[#17211B]">{statusCounts[item.key]}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex-1 lg:flex-auto">
            <div className="relative">
              <Package className="absolute left-2.5 top-2.5 h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                placeholder="Buscar código, producto, sucursal o motivo"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] pl-8 pr-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm"
            >
              <option value="all">Todos los tipos</option>
              <option value="transfer">Transferencia</option>
              <option value="replenishment">Reposición</option>
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm"
            >
              <option value="all">Todas las sucursales</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm"
              placeholder="Desde"
            />
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm"
              placeholder="Hasta"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Código</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Tipo</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Producto</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Sucursal / Origen → Destino</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Cantidad</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Responsable</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Fecha</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Estado</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Prioridad</th>
                <th className="px-5 py-3 text-xs font-semibold text-[#64748B]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-sm text-[#94A3B8] text-center">
                    Sin solicitudes que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filtered.map((op) => (
                  <tr key={op.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-4">
                      <span className="font-semibold text-[#17211B]">{op.code}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-xs">
                        {op.type === 'TRANSFER' ? (
                          <ArrowLeftRight className="h-3 w-3 text-[#168447]" />
                        ) : (
                          <RefreshCw className="h-3 w-3 text-[#168447]" />
                        )}
                        {op.type === 'TRANSFER' ? 'Transferencia' : 'Reposición'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#17211B]">{op.product}</td>
                    <td className="px-5 py-4 text-sm text-[#64748B]">
                      {op.type === 'TRANSFER'
                        ? `${op.originBranch} → ${op.destinationBranch}`
                        : op.branch ?? '-'}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#17211B]">
                      {op.quantity}{op.unit ? ` ${op.unit}` : ''}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#64748B]">
                      {op.requestedBy?.name ?? op.requestedBy?.email ?? '-'}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#64748B]">{formatDate(op.requestedAt)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          op.status === 'REJECTED'
                            ? 'bg-[#FEE4E6] text-[#D92732]'
                            : op.status === 'RECEIVED'
                              ? 'bg-[#DFFFE8] text-[#168447]'
                              : op.status === 'APPROVED' || op.status === 'REQUESTED' || op.status === 'ORDERED'
                                ? 'bg-[#DFFFE8] text-[#168447]'
                                : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}
                      >
                        {statusLabel(op.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${priorityColor(op.priority)}`}>
                        {op.priority === 'HIGH' ? 'Alta' : op.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {rowActions(op).map((button) => (
                          <button
                            key={button.action}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              if (button.action === 'DETAIL') openDetail(op)
                              else if (button.action === 'REJECT') handleAction(op, 'REJECT')
                              else handleAction(op, button.action)
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${button.tone}`}
                          >
                            {loading ? 'Procesando…' : button.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {error ? <div className="p-4 text-xs text-[#D92732] bg-[#FEE4E6]">{error}</div> : null}
      </div>

      <div className="mt-4 text-xs text-[#64748B]">
        Roles: {viewerRole}. Las acciones rápidas dependen de los permisos de sesión. Use el detalle para confirmar origen, despacho y recepción con lotes.
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeDetail}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#17211B]">
                {selected.type === 'TRANSFER' ? 'Transferencia' : 'Reposición'} {selected.code}
              </h3>
              <button type="button" onClick={closeDetail} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F8FAFC]">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {detailLoading ? (
                <div className="text-sm text-[#64748B]">Cargando detalle…</div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div className="rounded-xl border border-[#E2E8F0] p-4">
                      <p className="text-xs font-semibold text-[#64748B] uppercase">Tipo</p>
                      <p className="text-sm">{selected.type === 'TRANSFER' ? 'Transferencia entre sucursales' : 'Reposición inteligente'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] p-4">
                      <p className="text-xs font-semibold text-[#64748B] uppercase">Estado</p>
                      <p className="text-sm">{statusLabel(detail?.status ?? selected.status)}</p>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] p-4">
                      <p className="text-xs font-semibold text-[#64748B] uppercase">Prioridad</p>
                      <p className="text-sm">{selected.priority === 'HIGH' ? 'Alta' : selected.priority === 'MEDIUM' ? 'Media' : 'Baja'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] p-4">
                      <p className="text-xs font-semibold text-[#64748B] uppercase">Fecha</p>
                      <p className="text-sm">{formatDate(selected.requestedAt)}</p>
                    </div>
                  </div>

                  {selected.type === 'TRANSFER' ? (
                    <>
                      <div className="mt-4 grid gap-4 lg:grid-cols-4">
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Origen</p>
                          <p className="text-sm">{detail?.originBranch?.name ?? selected.originBranch}</p>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Destino</p>
                          <p className="text-sm">{detail?.destinationBranch?.name ?? selected.destinationBranch}</p>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Solicitado por</p>
                          <p className="text-sm">{detail?.requestedBy?.name ?? detail?.requestedBy?.email ?? selected.requestedBy?.name ?? '-'}</p>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Observaciones</p>
                          <p className="text-sm">{detail?.notes ?? selected.reason ?? 'Sin observaciones'}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Productos y lotes de origen</h4>
                        <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#E2E8F0]">
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Producto</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Solicitado</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Aprobado</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Despachado</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Recepcionado</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Lotes / vencimiento</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                              {detailTransferItems.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-6 text-sm text-[#94A3B8] text-center">Sin ítems.</td></tr>
                              ) : (
                                detailTransferItems.map((item) => (
                                  <tr key={item.id} className="hover:bg-[#F8FAFC]">
                                    <td className="px-4 py-3 text-sm">{item.product?.name ?? '-'} ({item.product?.sku ?? '-'})</td>
                                    <td className="px-4 py-3 text-sm">{item.requestedQuantity}</td>
                                    <td className="px-4 py-3 text-sm">{item.approvedQuantity}</td>
                                    <td className="px-4 py-3 text-sm">{item.dispatchedQuantity}</td>
                                    <td className="px-4 py-3 text-sm">{item.receivedQuantity}</td>
                                    <td className="px-4 py-3 text-sm text-[#64748B]">
                                      {item.lots?.map((lot) => `${lot.inventoryLot?.lotNumber ?? '-'} vence ${formatDate(lot.inventoryLot?.expirationDate ?? '')}`).join(', ') ?? '-'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {detailActions()}
                    </>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-4 lg:grid-cols-4">
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Sucursal</p>
                          <p className="text-sm">{detail?.branch?.name ?? selected.branch}</p>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Producto</p>
                          <p className="text-sm">{detail?.product?.name ?? selected.product}</p>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Stock actual</p>
                          <p className="text-sm">{detailReplenishmentItems[0]?.currentStock ?? selected.currentStock ?? '-'}</p>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-xs font-semibold text-[#64748B] uppercase">Mínimo / Objetivo</p>
                          <p className="text-sm">
                            {detailSetting?.minimumStock ?? selected.minimumStock ?? '-'} / {detailSetting?.targetStock ?? selected.targetStock ?? '-'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Ítem y cálculo</h4>
                        <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#E2E8F0]">
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Producto</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Stock actual</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Mínimo</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Objetivo</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Sugerida</th>
                                <th className="px-4 py-3 text-xs font-semibold text-[#64748B]">Solicitada</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                              {detailReplenishmentItems.map((item) => (
                                <tr key={item.id} className="hover:bg-[#F8FAFC]">
                                  <td className="px-4 py-3 text-sm">{detail?.product?.name ?? selected.product}</td>
                                  <td className="px-4 py-3 text-sm">{item.currentStock}</td>
                                  <td className="px-4 py-3 text-sm">{item.minimumStock}</td>
                                  <td className="px-4 py-3 text-sm">{item.targetStock}</td>
                                  <td className="px-4 py-3 text-sm">{item.requestedQuantity}</td>
                                  <td className="px-4 py-3 text-sm">{item.requestedQuantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {detail?.evidence && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Análisis generado</h4>
                          <div className="rounded-xl border border-[#E2E8F0] p-4 text-sm text-[#64748B]">
                            {typeof detail.evidence === 'string' ? detail.evidence : JSON.stringify(detail.evidence, null, 2).slice(0, 1200)}
                          </div>
                        </div>
                      )}

                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-[#64748B] uppercase mb-2">Documento PDF</h4>
                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                          <p className="text-sm text-[#64748B]">Generado automáticamente al crear la solicitud.</p>
                          <Link
                            href={`/api/documents/${(selected as Operation).type === 'TRANSFER' ? 'transfers' : 'replenishments'}/${selected.id}`}
                            className="inline-flex items-center rounded-lg border border-[#168447] px-3 py-1.5 text-xs font-semibold text-[#168447] hover:bg-[#168447] hover:text-white"
                          >
                            <FileText className="h-3 w-3 mr-2" /> Ver PDF
                          </Link>
                        </div>
                      </div>

                      {detailActions()}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejecting(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl border border-[#E2E8F0] shadow-2xl p-6">
            <h3 className="text-lg font-bold text-[#17211B]">Rechazar solicitud</h3>
            <p className="text-sm text-[#64748B]">El motivo del rechazo es obligatorio y se registrará en auditoría.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo del rechazo"
              className="mt-3 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="rounded-lg px-4 py-1.5 text-sm text-[#64748B] hover:bg-[#F8FAFC]">Cancelar</button>
              <button type="button" disabled={!rejectReason.trim() || detailLoading} onClick={submitReject} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white bg-[#D92732] disabled:opacity-50 hover:bg-[#b82428]">Rechazar</button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirming(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl border border-[#E2E8F0] shadow-2xl p-6">
            <h3 className="text-lg font-bold text-[#17211B]">Confirmar acción</h3>
            <p className="text-sm text-[#64748B]">¿Desea ejecutar esta acción ahora? El cambio se reflejará inmediatamente en la web y en Telegram.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(null)} className="rounded-lg px-4 py-1.5 text-sm text-[#64748B] hover:bg-[#F8FAFC]">Cancelar</button>
              <button type="button" disabled={detailLoading} onClick={submitConfirm} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white bg-[#168447] disabled:opacity-50 hover:bg-[#116638]">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
