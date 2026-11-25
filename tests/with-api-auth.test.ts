import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/dal', () => ({ getAuthUser: vi.fn() }))

import { withApiAuth } from '@/lib/auth/api'
import { getAuthUser, type AuthUser } from '@/lib/auth/dal'
import { ADMIN_ONLY, APPROVAL_ROLES } from '@/lib/auth/permissions'

type Context = { params: Promise<{ id: string }> }

const mockedGetAuthUser = vi.mocked(getAuthUser)
const request = new Request('http://localhost/api/products')
const admin: AuthUser = {
  id: 'prisma-admin',
  authId: 'supabase-admin',
  name: 'Administrador Demo',
  email: 'admin@inka.dev',
  role: 'ADMIN',
}
const inventoryManager: AuthUser = {
  ...admin,
  id: 'prisma-inventory',
  authId: 'supabase-inventory',
  email: 'inv@inka.dev',
  role: 'INVENTORY_MANAGER',
}

describe('withApiAuth', () => {
  beforeEach(() => {
    mockedGetAuthUser.mockReset()
  })

  it('devuelve 401 sin usuario y no ejecuta el handler', async () => {
    mockedGetAuthUser.mockResolvedValue(null)
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const guarded = withApiAuth(undefined, handler)

    const response = await guarded(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
    })
    expect(handler).not.toHaveBeenCalled()
    expect(mockedGetAuthUser).toHaveBeenCalledOnce()
  })

  it('devuelve 403 si el rol no está permitido', async () => {
    mockedGetAuthUser.mockResolvedValue({ ...admin, role: 'SUPERVISOR' })
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const guarded = withApiAuth(ADMIN_ONLY, handler)

    const response = await guarded(request)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Acceso denegado' },
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('devuelve 403 para un rol de escritura fuera de aprobaciones', async () => {
    mockedGetAuthUser.mockResolvedValue(inventoryManager)
    const handler = vi.fn(async () => Response.json({ ok: true }))
    const guarded = withApiAuth(APPROVAL_ROLES, handler)

    const response = await guarded(request)

    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('pasa user.id al handler y conserva el contexto con un rol válido', async () => {
    mockedGetAuthUser.mockResolvedValue(admin)
    const context: Context = { params: Promise.resolve({ id: 'product-1' }) }
    const handler = vi.fn(
      async (incoming: Request, ctx: Context | undefined, user: AuthUser) =>
        Response.json({
          userId: user.id,
          role: user.role,
          productId: ctx ? (await ctx.params).id : null,
          url: incoming.url,
        }),
    )
    const guarded = withApiAuth<Context>(ADMIN_ONLY, handler)

    const response = await guarded(
      new Request('http://localhost/api/products/product-1'),
      context,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      userId: 'prisma-admin',
      role: 'ADMIN',
      productId: 'product-1',
      url: 'http://localhost/api/products/product-1',
    })
    expect(handler).toHaveBeenCalledOnce()
    expect(mockedGetAuthUser).toHaveBeenCalledOnce()
  })

  it('acepta cualquier rol autenticado cuando no se exigen roles', async () => {
    mockedGetAuthUser.mockResolvedValue(inventoryManager)
    const handler = vi.fn(async (_request: Request, _context: unknown, user: AuthUser) =>
      Response.json({ userId: user.id }),
    )
    const guarded = withApiAuth(undefined, handler)

    const response = await guarded(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ userId: 'prisma-inventory' })
    expect(handler).toHaveBeenCalledOnce()
  })
})
