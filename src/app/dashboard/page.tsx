import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { AlertTriangle, Bell, Boxes, Package, RefreshCw, Building2 } from 'lucide-react'
import { getDashboardKpis } from '@/services/dashboard.service'
import { SessionGuard } from '@/components/auth/session-guard'
import { ALL_ROLES } from '@/lib/auth/permissions'

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#64748B]">Cargando…</div>}>
      <SessionGuard roles={ALL_ROLES}>
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] shadow-sm">
              Cargando indicadores del inventario...
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </SessionGuard>
    </Suspense>
  )
}

async function DashboardContent() {
  await connection()
  const kpis = await getDashboardKpis()

  const stats = [
    { label: 'Productos', value: kpis.totalProducts, href: '/dashboard/products', icon: Package, color: 'text-[#168447]' },
    { label: 'Sucursales', value: kpis.totalBranches, href: '/dashboard/branches', icon: Building2, color: 'text-[#168447]' },
    { label: 'Unidades disponibles', value: kpis.availableUnits, href: '/dashboard/inventory', icon: Boxes, color: 'text-[#168447]' },
    { label: 'Stock crítico', value: kpis.criticalAlerts, href: '/dashboard/alerts', icon: AlertTriangle, color: 'text-[#D92732]' },
    { label: 'Agotados', value: kpis.expiredAlerts, href: '/dashboard/alerts', icon: AlertTriangle, color: 'text-[#D92732]' },
    { label: 'Próximos vencimientos', value: kpis.expiringSoon.length, href: '/dashboard/alerts', icon: Bell, color: 'text-[#F5C400]' },
    { label: 'Reposiciones pendientes', value: kpis.pendingReplenishments, href: '/dashboard/replenishments', icon: RefreshCw, color: 'text-[#F5C400]' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[#17211B]">Resumen del inventario</h2>
        <p className="text-sm text-[#64748B]">Indicadores calculados en tiempo real desde la base de datos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#64748B]">{stat.label}</span>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="mt-2 text-3xl font-bold text-[#17211B]">{stat.value}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#17211B]">Próximos vencimientos</h3>
          <div className="mt-4 space-y-3">
            {kpis.expiringSoon.length === 0 && <p className="text-sm text-[#64748B]">Sin lotes próximos a vencer.</p>}
            {kpis.expiringSoon.map((lot) => (
              <div key={lot.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3">
                <div>
                  <p className="text-sm font-medium text-[#17211B]">{lot.product.name}</p>
                  <p className="text-xs text-[#64748B]">{lot.lotNumber} · {lot.branch.name}</p>
                </div>
                <span className="text-sm font-semibold text-[#D92732]">
                  {new Date(lot.expirationDate).toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#17211B]">Actividad reciente</h3>
          <div className="mt-4 space-y-3">
            {kpis.recentMovements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3">
                <div>
                  <p className="text-sm font-medium text-[#17211B]">{movement.product.name}</p>
                  <p className="text-xs text-[#64748B]">{movement.branch.name}</p>
                </div>
                <span className="text-xs font-semibold uppercase text-[#168447]">{movement.type}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#17211B]">Alertas pendientes por prioridad</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-[#F8FAFC] p-4">
            <p className="text-2xl font-bold text-[#D92732]">{kpis.criticalAlerts}</p>
            <p className="text-xs text-[#64748B]">Críticas activas</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-4">
            <p className="text-2xl font-bold text-[#F5C400]">{kpis.pendingAlerts - kpis.criticalAlerts}</p>
            <p className="text-xs text-[#64748B]">Pendientes totales</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-4">
            <p className="text-2xl font-bold text-[#168447]">{kpis.lowStockAlerts}</p>
            <p className="text-xs text-[#64748B]">Stock bajo</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Link
          href="/dashboard/alerts"
          className="rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#116638]"
        >
          Ver alertas
        </Link>
      </div>
    </div>
  )
}
