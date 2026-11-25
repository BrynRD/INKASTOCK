import { MovementType } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'
import type { Actor, DbClient } from '@/lib/actor'
import { assertBranchAccess, assertRole } from '@/services/access.service'
import { writeAudit } from '@/services/audit.service'
import { nextOperationCode } from '@/lib/operation-codes'
import { getStockByProductBranch } from '@/services/inventory.service'
import { getIncomingTransferQuantity } from '@/services/transfer.service'

const OPEN_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'PENDING',
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
] as const

const OPERATION_ROLES = ['ADMIN', 'SUPERVISOR', 'INVENTORY_MANAGER'] as const
const APPROVAL_ROLES = ['ADMIN', 'SUPERVISOR'] as const

export type CreateReplenishmentInput = {
  productId: string
  branchId: string
  requestedQuantity: number
  reason?: string
  evidence?: object
  idempotencyKey?: string
}

export type ReplenishmentLotInput = {
  lotNumber: string
  expirationDate: string
  quantity: number
}

export type ReceiveReplenishmentInput = {
  quantity?: number
  expirationDate?: string
  lots?: ReplenishmentLotInput[]
  notes?: string
  idempotencyKey?: string
}

function isActor(value: Actor | string | undefined): value is Actor {
  return typeof value === 'object' && value !== null
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('EXPIRATION_DATE_REQUIRED')
  return new Date(`${value}T00:00:00.000Z`)
}

export async function suggestReplenishmentQuantity(
  productId: string,
  branchId: string,
  client: DbClient = prisma,
) {
  const [product, branch, settings, stock, incomingTransfers, openRows] = await Promise.all([
    client.product.findUnique({ where: { id: productId } }),
    client.branch.findUnique({ where: { id: branchId } }),
    client.inventorySettings.findUnique({
      where: { productId_branchId: { productId, branchId } },
    }),
    getStockByProductBranch(productId, branchId, client),
    getIncomingTransferQuantity(productId, branchId, client),
    client.replenishmentItem.findMany({
      where: {
        productId,
        replenishment: { branchId, status: { in: [...OPEN_STATUSES] } },
      },
      select: { requestedQuantity: true, receivedQuantity: true },
    }),
  ])

  if (!product || !branch) throw new Error('PRODUCT_OR_BRANCH_NOT_FOUND')

  const minimumStock = settings?.minimumStock ?? 0
  const targetStock = settings?.targetStock ?? Math.max(minimumStock * 2, 1)
  const openRequests = openRows.reduce(
    (total, row) => total + Math.max(0, row.requestedQuantity - row.receivedQuantity),
    0,
  )
  const projectedStock = stock + incomingTransfers + openRequests
  const suggestedQuantity = Math.max(0, targetStock - projectedStock)

  return {
    productId,
    productName: product.name,
    branchId,
    branchName: branch.name,
    stock,
    minimumStock,
    targetStock,
    incomingTransfers,
    openRequests,
    projectedStock,
    suggestedQuantity,
  }
}

export function listReplenishments(params: {
  status?: string
  branchId?: string
  productId?: string
  code?: string
  page?: number
  pageSize?: number
}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Record<string, unknown> = {}

  if (params.status) where.status = params.status
  if (params.branchId) where.branchId = params.branchId
  if (params.productId) where.productId = params.productId
  if (params.code) where.code = { contains: params.code, mode: 'insensitive' }

  return prisma.$transaction([
    prisma.replenishment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { requestedAt: 'desc' },
      include: {
        product: true,
        branch: true,
        requestedByUser: { select: { id: true, name: true, email: true } },
        authorizedByUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.replenishment.count({ where }),
  ]).then(([data, total]) => ({ data, total, page, pageSize }))
}

export function getReplenishment(id: string) {
  return prisma.replenishment.findUnique({
    where: { id },
    include: {
      product: true,
      branch: true,
      requestedByUser: { select: { id: true, name: true, email: true } },
      authorizedByUser: { select: { id: true, name: true, email: true } },
      reviewedByUser: { select: { id: true, name: true, email: true } },
      items: { include: { lots: true } },
      documents: true,
    },
  })
}

export async function createReplenishment(actor: Actor, input: CreateReplenishmentInput) {
  assertRole(actor, [...OPERATION_ROLES])

  if (!Number.isInteger(input.requestedQuantity) || input.requestedQuantity <= 0) {
    throw new Error('INVALID_QUANTITY')
  }

  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.replenishment.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (existing) {
        const existingSuggestion = await suggestReplenishmentQuantity(input.productId, input.branchId, tx)
        return { replenishment: existing, suggestion: existingSuggestion }
      }
    }

    await assertBranchAccess(tx, actor, input.branchId)

    const suggestion = await suggestReplenishmentQuantity(input.productId, input.branchId, tx)
    const code = await nextOperationCode(tx, 'REP')
    const replenishment = await tx.replenishment.create({
      data: {
        code,
        productId: input.productId,
        branchId: input.branchId,
        requestedQuantity: input.requestedQuantity,
        status: 'PENDING_APPROVAL',
        reason: input.reason,
        requestedBy: actor.email,
        requestedById: actor.id,
        evidence: { ...suggestion, ...(input.evidence ?? {}) } as object,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: {
            productId: input.productId,
            currentStock: suggestion.stock,
            minimumStock: suggestion.minimumStock,
            targetStock: suggestion.targetStock,
            requestedQuantity: input.requestedQuantity,
          },
        },
      },
      include: { items: true },
    })

    await writeAudit(tx, {
      userId: actor.id,
      action: 'REPLENISHMENT_CREATED',
      entityType: 'Replenishment',
      entityId: replenishment.id,
      newData: { code, suggestion },
      idempotencyKey: input.idempotencyKey ? `audit:${input.idempotencyKey}` : undefined,
    })

    return { replenishment, suggestion }
  })
}

export async function authorizeReplenishment(id: string, actor: Actor) {
  assertRole(actor, [...APPROVAL_ROLES])
  return prisma.$transaction(async (tx) => {
    const replenishment = await tx.replenishment.findUnique({ where: { id } })
    if (!replenishment) throw new Error('REPLENISHMENT_NOT_FOUND')
    if (replenishment.authorizedById) return replenishment
    if (replenishment.status !== 'PENDING_APPROVAL') throw new Error('REPLENISHMENT_INVALID_STATE')

    const updated = await tx.replenishment.update({
      where: { id },
      data: {
        status: 'REQUESTED',
        authorizedById: actor.id,
        approvedBy: actor.email,
      },
    })
    await writeAudit(tx, {
      userId: actor.id,
      action: 'REPLENISHMENT_AUTHORIZED',
      entityType: 'Replenishment',
      entityId: id,
      previousData: { status: replenishment.status },
      newData: { status: updated.status },
    })
    return updated
  })
}

export async function approveReplenishment(id: string, actorOrEmail: Actor | string) {
  const actor: Actor = isActor(actorOrEmail)
    ? actorOrEmail
    : { id: '', role: 'SUPERVISOR', email: actorOrEmail }
  assertRole(actor, [...APPROVAL_ROLES])
  return prisma.$transaction(async (tx) => {
    const replenishment = await tx.replenishment.findUnique({ where: { id } })
    if (!replenishment) throw new Error('REPLENISHMENT_NOT_FOUND')
    if (!['PENDING_APPROVAL', 'PENDING', 'REQUESTED', 'UNDER_REVIEW'].includes(replenishment.status)) {
      throw new Error('REPLENISHMENT_INVALID_STATE')
    }

    const updated = await tx.replenishment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: actor.id || null,
        reviewedAt: new Date(),
        approvedBy: actor.email ?? replenishment.approvedBy,
      },
    })
    await writeAudit(tx, {
      userId: actor.id || undefined,
      action: 'REPLENISHMENT_APPROVED',
      entityType: 'Replenishment',
      entityId: id,
      newData: { status: updated.status },
    })
    return updated
  })
}

export async function rejectReplenishment(id: string, actorOrReason?: Actor | string, reason?: string) {
  const actor: Actor = isActor(actorOrReason)
    ? actorOrReason
    : { id: '', role: 'SUPERVISOR' }
  const finalReason = isActor(actorOrReason) ? reason : actorOrReason
  assertRole(actor, [...OPERATION_ROLES])
  return prisma.$transaction(async (tx) => {
    const replenishment = await tx.replenishment.findUnique({ where: { id } })
    if (!replenishment) throw new Error('REPLENISHMENT_NOT_FOUND')
    if (['RECEIVED', 'REJECTED', 'CANCELLED'].includes(replenishment.status)) {
      throw new Error('REPLENISHMENT_INVALID_STATE')
    }

    const updated = await tx.replenishment.update({
      where: { id },
      data: { status: 'REJECTED', reason: finalReason ?? replenishment.reason },
    })
    await writeAudit(tx, {
      userId: actor.id || undefined,
      action: 'REPLENISHMENT_REJECTED',
      entityType: 'Replenishment',
      entityId: id,
      newData: { reason: finalReason },
    })
    return updated
  })
}

export async function markReplenishmentOrdered(id: string, actor: Actor) {
  assertRole(actor, [...APPROVAL_ROLES])
  return prisma.$transaction(async (tx) => {
    const replenishment = await tx.replenishment.findUnique({ where: { id } })
    if (!replenishment) throw new Error('REPLENISHMENT_NOT_FOUND')
    if (!['REQUESTED', 'APPROVED', 'UNDER_REVIEW'].includes(replenishment.status)) {
      throw new Error('REPLENISHMENT_INVALID_STATE')
    }

    const updated = await tx.replenishment.update({
      where: { id },
      data: { status: 'ORDERED', orderedAt: new Date() },
    })
    await writeAudit(tx, {
      userId: actor.id,
      action: 'REPLENISHMENT_ORDERED',
      entityType: 'Replenishment',
      entityId: id,
      newData: { status: updated.status },
    })
    return updated
  })
}

export async function receiveIntelligentReplenishment(
  id: string,
  actor: Actor,
  input: ReceiveReplenishmentInput,
) {
  assertRole(actor, [...OPERATION_ROLES])
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const processed = await tx.auditLog.findUnique({
        where: { idempotencyKey: `receive-rep:${input.idempotencyKey}` },
      })
      if (processed) return tx.replenishment.findUnique({ where: { id } })
    }

    const replenishment = await tx.replenishment.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!replenishment) throw new Error('REPLENISHMENT_NOT_FOUND')
    if (!['REQUESTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(replenishment.status)) {
      throw new Error('REPLENISHMENT_INVALID_STATE')
    }
    await assertBranchAccess(tx, actor, replenishment.branchId)

    const pendingQuantity = replenishment.requestedQuantity - replenishment.receivedQuantity
    if (pendingQuantity <= 0) throw new Error('REPLENISHMENT_ALREADY_RECEIVED')

    const quantity = input.quantity ?? pendingQuantity
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > pendingQuantity) {
      throw new Error('INVALID_QUANTITY')
    }

    const lots = input.lots ?? [{
      lotNumber: `REP-${replenishment.code}-${replenishment.receivedQuantity + 1}`,
      expirationDate: input.expirationDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      quantity,
    }]

    const lotTotal = lots.reduce((total, lot) => total + lot.quantity, 0)
    if (lotTotal !== quantity) throw new Error('LOT_QUANTITY_MISMATCH')

    for (const lot of lots) {
      if (!Number.isInteger(lot.quantity) || lot.quantity <= 0) throw new Error('INVALID_QUANTITY')
      const expirationDate = parseDate(lot.expirationDate)
      const existing = await tx.inventoryLot.findUnique({
        where: {
          productId_branchId_lotNumber: {
            productId: replenishment.productId,
            branchId: replenishment.branchId,
            lotNumber: lot.lotNumber,
          },
        },
      })
      const inventoryLot = existing
        ? await tx.inventoryLot.update({
            where: { id: existing.id },
            data: { quantity: { increment: lot.quantity } },
          })
        : await tx.inventoryLot.create({
            data: {
              productId: replenishment.productId,
              branchId: replenishment.branchId,
              lotNumber: lot.lotNumber,
              quantity: lot.quantity,
              expirationDate,
            },
          })

      await tx.inventoryMovement.create({
        data: {
          productId: replenishment.productId,
          branchId: replenishment.branchId,
          lotId: inventoryLot.id,
          type: MovementType.REPLENISHMENT,
          quantity: lot.quantity,
          reason: `Reposición ${replenishment.code}`,
          referenceId: replenishment.id,
          userId: actor.id,
        },
      })

      const item = replenishment.items[0]
      if (item) {
        await tx.replenishmentLot.create({
          data: {
            replenishmentItemId: item.id,
            inventoryLotId: inventoryLot.id,
            quantity: lot.quantity,
            receivedById: actor.id,
          },
        })
      }
    }

    const newReceived = replenishment.receivedQuantity + quantity
    const updated = await tx.replenishment.update({
      where: { id },
      data: {
        receivedQuantity: newReceived,
        status: newReceived >= replenishment.requestedQuantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedAt: new Date(),
        reason: input.notes ?? replenishment.reason,
      },
    })

    if (replenishment.items[0]) {
      await tx.replenishmentItem.update({
        where: { id: replenishment.items[0].id },
        data: { receivedQuantity: { increment: quantity } },
      })
    }

    await writeAudit(tx, {
      userId: actor.id,
      action: 'REPLENISHMENT_RECEIVED',
      entityType: 'Replenishment',
      entityId: id,
      previousData: { status: replenishment.status, receivedQuantity: replenishment.receivedQuantity },
      newData: { status: updated.status, receivedQuantity: newReceived },
      idempotencyKey: input.idempotencyKey ? `receive-rep:${input.idempotencyKey}` : undefined,
    })

    return updated
  })
}

export async function receiveReplenishment(id: string, expirationDate?: string) {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true } })
  if (!admin) throw new Error('ADMIN_NOT_FOUND')

  return receiveIntelligentReplenishment(id, {
    id: admin.id,
    role: admin.role,
    email: admin.email,
    name: admin.name,
  }, {
    expirationDate: expirationDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  })
}
