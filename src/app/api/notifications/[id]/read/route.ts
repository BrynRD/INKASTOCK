import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { markNotificationRead } from '@/services/notification-center.service'

export const PATCH = withApiAuth<{ params: Promise<{ id: string }> }>(ALL_ROLES, async (request, ctx, user) => {
  const { id } = await ctx!.params
  const body = await request.json().catch(() => ({}))
  const read = body.read !== false

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return errorResponse(404, 'NOT_FOUND', 'Notificación no encontrada')
  if (notification.userId !== user.id) return errorResponse(403, 'FORBIDDEN', 'Acceso denegado')

  if (read) {
    await markNotificationRead(id, user.id)
  }
  return successResponse({ ok: true })
})
