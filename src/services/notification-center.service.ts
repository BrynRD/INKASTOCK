import type { DbClient } from '@/lib/actor'
import { prisma } from '@/lib/prisma'

export type NotificationInput = {
  userId: string
  type: string
  operationType?: string
  operationId?: string
  title: string
  body: string
  link?: string
  channel?: string
}

export async function getNotifiableUserIds(client: DbClient, branchIds?: string[]) {
  if (branchIds && branchIds.length > 0) {
    const links = await client.userBranch.findMany({
      where: { branchId: { in: branchIds }, active: true },
      select: { userId: true },
    })
    const ids = [...new Set(links.map((link) => link.userId))]
    if (ids.length > 0) return ids
  }

  const users = await client.user.findMany({ where: { active: true }, select: { id: true } })
  return users.map((user) => user.id)
}

export async function createNotification(client: DbClient, input: NotificationInput) {
  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      operationType: input.operationType ?? null,
      operationId: input.operationId ?? null,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      channel: input.channel ?? 'WEB',
    },
  })
}

export async function notifyOperation(client: DbClient, input: {
  channel: string
  actorId: string
  operationType: string
  operationId: string
  title: string
  body: string
  link?: string
  branchIds?: string[]
}) {
  const userIds = await getNotifiableUserIds(client, input.branchIds)
  await Promise.all(
    userIds.map((userId) =>
      createNotification(client, {
        userId,
        type: 'APPROVAL',
        operationType: input.operationType,
        operationId: input.operationId,
        title: input.title,
        body: input.body,
        link: input.link,
        channel: input.channel,
      }),
    ),
  )
}

export async function listNotifications(userId: string, input: { unreadOnly?: boolean; limit?: number } = {}) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(input.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 50,
  })
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } })
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  })
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  })
}
