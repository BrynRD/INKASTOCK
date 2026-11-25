'use client'

import Link from 'next/link'
import {
  ArrowLeftRight,
  Bell,
  Bot,
  Boxes,
  Building2,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  Package,
  RefreshCw,
  Send,
  Settings,
} from 'lucide-react'
import NotificationBell from '@/components/notifications/notification-bell'
import type { AuthUser } from '@/lib/auth/dal'
import { NAV_ROLES } from '@/lib/auth/permissions'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/products', label: 'Productos', icon: Package },
  { href: '/dashboard/branches', label: 'Sucursales', icon: Building2 },
  { href: '/dashboard/inventory', label: 'Inventario', icon: Boxes },
  { href: '/dashboard/inventory/lots', label: 'Lotes', icon: Layers },
  { href: '/dashboard/inventory/movements', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/dashboard/alerts', label: 'Alertas', icon: Bell },
  { href: '/dashboard/replenishments', label: 'Reposiciones', icon: RefreshCw },
  { href: '/dashboard/transfers', label: 'Transferencias', icon: ArrowLeftRight },
  { href: '/dashboard/notifications', label: 'Bandeja', icon: Inbox },
  { href: '/dashboard/notify-approvals', label: 'Notificaciones y aprobaciones', icon: Bell },
  { href: '/dashboard/telegram', label: 'Telegram', icon: Send },
  { href: '/dashboard/reports', label: 'Reportes', icon: FileText },
  { href: '/dashboard/automations', label: 'Automatizaciones', icon: Bot },
  { href: '/dashboard/chatbot', label: 'Chatbot', icon: Bot },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
]

export default function DashboardNav({ user }: { user: AuthUser }) {
  const items = NAV_ITEMS.filter((item) => NAV_ROLES[item.href]?.includes(user.role))

  return (
    <nav className="flex flex-1 items-center gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:px-3 lg:py-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon className="h-4 w-4" />
            {item.label}
            {item.href === '/dashboard/notify-approvals' && <NotificationBell />}
          </Link>
        )
      })}
    </nav>
  )
}
