import type { DbClient } from '@/lib/actor'

export async function writeAudit(
  client: DbClient,
  input: {
    userId?: string
    action: string
    entityType: string
    entityId: string
    previousData?: object
    newData?: object
    idempotencyKey?: string
  },
) {
  return client.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousData: input.previousData as object,
      newData: input.newData as object,
      idempotencyKey: input.idempotencyKey,
    },
  })
}
