import { describe, expect, it } from 'vitest'
import type { UserRole } from '@/generated/prisma/enums'
import {
  ADMIN_ONLY,
  ALL_ROLES,
  APPROVAL_ROLES,
  INVENTORY_WRITE_ROLES,
  NAV_ROLES,
  REPORT_ROLES,
} from '@/lib/auth/permissions'

describe('constantes de permisos', () => {
  it('define los tres roles de negocio', () => {
    expect(ALL_ROLES).toEqual(['ADMIN', 'SUPERVISOR', 'INVENTORY_MANAGER'])
  })

  it('ADMIN_ONLY solo permite ADMIN', () => {
    expect(ADMIN_ONLY).toEqual(['ADMIN'])
  })

  it('INVENTORY_WRITE_ROLES permite ADMIN e INVENTORY_MANAGER', () => {
    expect(INVENTORY_WRITE_ROLES).toEqual(['ADMIN', 'INVENTORY_MANAGER'])
  })

  it('APPROVAL_ROLES permite ADMIN y SUPERVISOR', () => {
    expect(APPROVAL_ROLES).toEqual(['ADMIN', 'SUPERVISOR'])
  })

  it('REPORT_ROLES permite ADMIN y SUPERVISOR', () => {
    expect(REPORT_ROLES).toEqual(['ADMIN', 'SUPERVISOR'])
  })
})

describe('NAV_ROLES', () => {
  it('cubre las quince rutas del panel con roles válidos', () => {
    expect(Object.keys(NAV_ROLES)).toEqual([
      '/dashboard',
      '/dashboard/products',
      '/dashboard/branches',
      '/dashboard/inventory',
      '/dashboard/inventory/lots',
      '/dashboard/inventory/movements',
      '/dashboard/alerts',
      '/dashboard/replenishments',
      '/dashboard/transfers',
      '/dashboard/notifications',
      '/dashboard/notify-approvals',
      '/dashboard/telegram',
      '/dashboard/reports',
      '/dashboard/automations',
      '/dashboard/chatbot',
      '/dashboard/settings',
    ])

    for (const roles of Object.values(NAV_ROLES)) {
      expect(roles.length).toBeGreaterThan(0)
      for (const role of roles) {
        expect(ALL_ROLES).toContain(role)
      }
    }
  })

  it('asigna las rutas restringidas a sus constantes', () => {
    expect(NAV_ROLES['/dashboard/branches']).toEqual(ADMIN_ONLY)
    expect(NAV_ROLES['/dashboard/automations']).toEqual(ADMIN_ONLY)
    expect(NAV_ROLES['/dashboard/settings']).toEqual(ADMIN_ONLY)
    expect(NAV_ROLES['/dashboard/reports']).toEqual(REPORT_ROLES)
  })

  it('deja el resto de rutas accesibles para todos los roles', () => {
    const restricted = new Set([
      '/dashboard/branches',
      '/dashboard/automations',
      '/dashboard/settings',
      '/dashboard/reports',
    ])

    for (const [route, roles] of Object.entries(NAV_ROLES)) {
      if (!restricted.has(route)) {
        expect(roles).toEqual(ALL_ROLES)
      }
    }
  })

  const expectedByRole: Record<UserRole, string[]> = {
    ADMIN: Object.keys(NAV_ROLES),
    SUPERVISOR: [
      '/dashboard',
      '/dashboard/products',
      '/dashboard/inventory',
      '/dashboard/inventory/lots',
      '/dashboard/inventory/movements',
      '/dashboard/alerts',
      '/dashboard/replenishments',
      '/dashboard/transfers',
    '/dashboard/notifications',
    '/dashboard/notify-approvals',
    '/dashboard/telegram',
    '/dashboard/reports',
    '/dashboard/chatbot',
  ],
    INVENTORY_MANAGER: [
      '/dashboard',
      '/dashboard/products',
      '/dashboard/inventory',
      '/dashboard/inventory/lots',
      '/dashboard/inventory/movements',
      '/dashboard/alerts',
      '/dashboard/replenishments',
      '/dashboard/transfers',
    '/dashboard/notifications',
    '/dashboard/notify-approvals',
    '/dashboard/telegram',
    '/dashboard/chatbot',
  ],
  }

  it.each(ALL_ROLES)('calcula la navegación permitida para %s', (role) => {
    const allowed = Object.entries(NAV_ROLES)
      .filter(([, roles]) => roles.includes(role))
      .map(([route]) => route)

    expect(allowed).toEqual(expectedByRole[role])
  })
})
