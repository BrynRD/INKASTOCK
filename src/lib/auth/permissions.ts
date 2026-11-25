import type { UserRole } from '@/generated/prisma/enums'

export const ALL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'INVENTORY_MANAGER']
export const ADMIN_ONLY: UserRole[] = ['ADMIN']
export const INVENTORY_WRITE_ROLES: UserRole[] = ['ADMIN', 'INVENTORY_MANAGER']
export const APPROVAL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR']
export const REPORT_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR']

export const NAV_ROLES: Record<string, UserRole[]> = {
  '/dashboard': ALL_ROLES,
  '/dashboard/products': ALL_ROLES,
  '/dashboard/branches': ADMIN_ONLY,
  '/dashboard/inventory': ALL_ROLES,
  '/dashboard/inventory/lots': ALL_ROLES,
  '/dashboard/inventory/movements': ALL_ROLES,
  '/dashboard/alerts': ALL_ROLES,
  '/dashboard/replenishments': ALL_ROLES,
  '/dashboard/transfers': ALL_ROLES,
  '/dashboard/notifications': ALL_ROLES,
  '/dashboard/notify-approvals': ALL_ROLES,
  '/dashboard/telegram': ALL_ROLES,
  '/dashboard/reports': REPORT_ROLES,
  '/dashboard/automations': ADMIN_ONLY,
  '/dashboard/chatbot': ALL_ROLES,
  '/dashboard/settings': ADMIN_ONLY,
}
