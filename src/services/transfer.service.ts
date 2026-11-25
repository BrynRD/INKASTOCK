import type { TransferStatus } from '@/generated/prisma/enums'
import { MovementType } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'
import type { Actor, DbClient } from '@/lib/actor'
import { assertBranchAccess, assertRole } from '@/services/access.service'
import { writeAudit } from '@/services/audit.service'
import { nextOperationCode } from '@/lib/operation-codes'
import { calculateFefoConsumption } from '@/lib/inventory-logic'
import { getAvailableLots, getStockByProductBranch, startOfDay } from '@/services/inventory.service'

const ACTIVE_STATUSES: TransferStatus[] = [
  'PENDING_ORIGIN_CONFIRMATION',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
]

const OPERATION_ROLES = ['ADMIN', 'SUPERVISOR', 'INVENTORY_MANAGER'] as const

export type TransferItemInput = {
  productId: string
  requestedQuantity: number
}

export type CreateTransferInput = {
  originBranchId: string
  destinationBranchId: string
  items: TransferItemInput[]
  notes?: string
  evidence?: object
  idempotencyKey?: string
  authorizedById?: string
}

export type ReceiveLotInput = {
  lotNumber: string
  expirationDate: string
  quantity: number
}

export type ReceiveTransferItemInput = {
  productId: string
  receivedQuantity: number
  lots?: ReceiveLotInput[]
}

export type ReceiveTransferInput = {
  items: ReceiveTransferItemInput[]
  notes?: string
  idempotencyKey?: string
}

export async function getTransferableStock(
  productId: string,
  branchId: string,
  client: DbClient = prisma,
  excludeTransferId?: string,
) {
  const [stock, rows] = await Promise.all([
    getStockByProductBranch(productId, branchId, client),
    client.transferItem.findMany({
      where: {
        productId,
        transfer: {
          originBranchId: branchId,
          status: { in: ACTIVE_STATUSES },
          ...(excludeTransferId ? { id: { not: excludeTransferId } } : {}),
        },
      },
      select: { requestedQuantity: true, approvedQuantity: true, receivedQuantity: true },
    }),
  ])

  const committed = rows.reduce((total, row) => {
    const quantity = row.approvedQuantity > 0 ? row.approvedQuantity : row.requestedQuantity
    return total + Math.max(0, quantity - row.receivedQuantity)
  }, 0)

  return Math.max(0, stock - committed)
}

export async function getIncomingTransferQuantity(
  productId: string,
  branchId: string,
  client: DbClient = prisma,
) {
  const rows = await client.transferItem.findMany({
    where: {
      productId,
      transfer: {
        destinationBranchId: branchId,
        status: { in: ACTIVE_STATUSES },
      },
    },
    select: { requestedQuantity: true, approvedQuantity: true, receivedQuantity: true },
  })

  return rows.reduce((total, row) => {
    const quantity = row.approvedQuantity > 0 ? row.approvedQuantity : row.requestedQuantity
    return total + Math.max(0, quantity - row.receivedQuantity)
  }, 0)
}

export async function recommendTransfer(productId: string, destinationBranchId: string) {
  const [product, destinationBranch, settings, destinationStock, incoming] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.branch.findUnique({ where: { id: destinationBranchId } }),
    prisma.inventorySettings.findUnique({
      where: { productId_branchId: { productId, branchId: destinationBranchId } },
    }),
    getStockByProductBranch(productId, destinationBranchId),
    getIncomingTransferQuantity(productId, destinationBranchId),
  ])

  if (!product || !destinationBranch) {
    throw new Error('PRODUCT_OR_BRANCH_NOT_FOUND')
  }

  const minimumStock = settings?.minimumStock ?? 0
  const targetStock = settings?.targetStock ?? Math.max(minimumStock * 2, 1)
  const projectedStock = destinationStock + incoming
  const needed = Math.max(0, targetStock - projectedStock)

  const branches = await prisma.branch.findMany({ where: { active: true, id: { not: destinationBranchId } } })
  const candidates = await Promise.all(branches.map(async (branch) => {
    const originSettings = await prisma.inventorySettings.findUnique({
      where: { productId_branchId: { productId, branchId: branch.id } },
    })
    const available = await getTransferableStock(productId, branch.id)
    const originMinimum = originSettings?.minimumStock ?? 0
    const surplus = Math.max(0, available - originMinimum)
    return {
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      available,
      minimumStock: originMinimum,
      surplus,
    }
  }))

  const sorted = candidates.filter((item) => item.surplus > 0).sort((a, b) => b.surplus - a.surplus)
  const recommendedQuantity = Math.min(needed, sorted.reduce((total, item) => total + item.surplus, 0))

  return {
    productId,
    productName: product.name,
    destinationBranchId,
    destinationBranchName: destinationBranch.name,
    destinationStock,
    incomingTransfers: incoming,
    minimumStock,
    targetStock,
    needed,
    recommendedQuantity,
    candidates: sorted,
  }
}

export function listTransfers(params: {
  status?: string
  branchId?: string
  productId?: string
  page?: number
  pageSize?: number
}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Record<string, unknown> = {}

  if (params.status) where.status = params.status
  if (params.branchId) {
    where.OR = [{ originBranchId: params.branchId }, { destinationBranchId: params.branchId }]
  }
  if (params.productId) where.items = { some: { productId: params.productId } }

  return prisma.$transaction([
    prisma.transfer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        originBranch: true,
        destinationBranch: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    }),
    prisma.transfer.count({ where }),
  ]).then(([data, total]) => ({ data, total, page, pageSize }))
}

export function getTransfer(id: string) {
  return prisma.transfer.findUnique({
    where: { id },
    include: {
      originBranch: true,
      destinationBranch: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      authorizedBy: { select: { id: true, name: true, email: true } },
      originConfirmedBy: { select: { id: true, name: true, email: true } },
      dispatchedBy: { select: { id: true, name: true, email: true } },
      receivedBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: true,
          lots: { include: { inventoryLot: true, receivedLot: true } },
        },
      },
      documents: true,
    },
  })
}

export async function createTransfer(actor: Actor, input: CreateTransferInput) {
  assertRole(actor, [...OPERATION_ROLES])

  if (input.originBranchId === input.destinationBranchId) {
    throw new Error('SAME_BRANCH')
  }
  if (input.items.length === 0) {
    throw new Error('EMPTY_TRANSFER')
  }

  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (existing) return existing
    }

    await assertBranchAccess(tx, actor, input.originBranchId)
    await assertBranchAccess(tx, actor, input.destinationBranchId)

    const uniqueItems = new Map<string, number>()
    for (const item of input.items) {
      if (!Number.isInteger(item.requestedQuantity) || item.requestedQuantity <= 0) {
        throw new Error('INVALID_QUANTITY')
      }
      uniqueItems.set(item.productId, (uniqueItems.get(item.productId) ?? 0) + item.requestedQuantity)
    }

    for (const [productId, quantity] of uniqueItems) {
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product?.active) throw new Error('PRODUCT_NOT_FOUND')
      const available = await getTransferableStock(productId, input.originBranchId, tx)
      if (quantity > available) throw new Error('INSUFFICIENT_STOCK')
    }

    const code = await nextOperationCode(tx, 'TRF')
    const transfer = await tx.transfer.create({
      data: {
        code,
        originBranchId: input.originBranchId,
        destinationBranchId: input.destinationBranchId,
        status: 'PENDING_ORIGIN_CONFIRMATION',
        requestedById: actor.id,
        authorizedById: input.authorizedById ?? (actor.role === 'INVENTORY_MANAGER' ? null : actor.id),
        authorizedAt: input.authorizedById || actor.role !== 'INVENTORY_MANAGER' ? new Date() : null,
        notes: input.notes,
        evidence: input.evidence as object,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: [...uniqueItems].map(([productId, requestedQuantity]) => ({
            productId,
            requestedQuantity,
          })),
        },
      },
      include: { items: true },
    })

    await writeAudit(tx, {
      userId: actor.id,
      action: 'TRANSFER_CREATED',
      entityType: 'Transfer',
      entityId: transfer.id,
      newData: { code, items: input.items },
      idempotencyKey: input.idempotencyKey ? `audit:${input.idempotencyKey}` : undefined,
    })

    return transfer
  })
}

export async function authorizeTransfer(id: string, actor: Actor) {
  assertRole(actor, ['ADMIN', 'SUPERVISOR'])
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({ where: { id } })
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND')
    if (transfer.authorizedById) return transfer
    if (!['DRAFT', 'PENDING_ORIGIN_CONFIRMATION'].includes(transfer.status)) {
      throw new Error('TRANSFER_INVALID_STATE')
    }

    const updated = await tx.transfer.update({
      where: { id },
      data: {
        status: 'PENDING_ORIGIN_CONFIRMATION',
        authorizedById: actor.id,
        authorizedAt: new Date(),
      },
    })
    await writeAudit(tx, {
      userId: actor.id,
      action: 'TRANSFER_AUTHORIZED',
      entityType: 'Transfer',
      entityId: id,
      previousData: { status: transfer.status },
      newData: { status: updated.status },
    })
    return updated
  })
}

export async function rejectTransfer(id: string, actor: Actor, reason?: string) {
  assertRole(actor, ['ADMIN', 'SUPERVISOR', 'INVENTORY_MANAGER'])
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({ where: { id } })
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND')
    if (['RECEIVED', 'REJECTED', 'CANCELLED'].includes(transfer.status)) {
      throw new Error('TRANSFER_INVALID_STATE')
    }

    const updated = await tx.transfer.update({
      where: { id },
      data: { status: 'REJECTED', notes: reason ?? transfer.notes },
    })
    await writeAudit(tx, {
      userId: actor.id,
      action: 'TRANSFER_REJECTED',
      entityType: 'Transfer',
      entityId: id,
      newData: { reason },
    })
    return updated
  })
}

export async function confirmTransferOrigin(
  id: string,
  actor: Actor,
  input: { items?: Array<{ productId: string; approvedQuantity: number }>; notes?: string },
) {
  assertRole(actor, [...OPERATION_ROLES])
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({ where: { id }, include: { items: true } })
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND')
    if (transfer.status !== 'PENDING_ORIGIN_CONFIRMATION') throw new Error('TRANSFER_INVALID_STATE')
    await assertBranchAccess(tx, actor, transfer.originBranchId)

    const decisions = new Map(input.items?.map((item) => [item.productId, item.approvedQuantity]) ?? [])

    for (const item of transfer.items) {
      const approved = decisions.get(item.productId) ?? item.requestedQuantity
      if (!Number.isInteger(approved) || approved <= 0 || approved > item.requestedQuantity) {
        throw new Error('INVALID_APPROVED_QUANTITY')
      }
      const available = await getTransferableStock(item.productId, transfer.originBranchId, tx, id)
      if (approved > available) throw new Error('INSUFFICIENT_STOCK')
    }

    const updated = await tx.transfer.update({
      where: { id },
      data: {
        status: 'APPROVED',
        originConfirmedById: actor.id,
        confirmedAt: new Date(),
        notes: input.notes ?? transfer.notes,
        items: {
          update: transfer.items.map((item) => ({
            where: { id: item.id },
            data: { approvedQuantity: decisions.get(item.productId) ?? item.requestedQuantity },
          })),
        },
      },
    })
    await writeAudit(tx, {
      userId: actor.id,
      action: 'TRANSFER_ORIGIN_CONFIRMED',
      entityType: 'Transfer',
      entityId: id,
      previousData: { status: transfer.status },
      newData: { status: updated.status, decisions: input.items ?? [] },
    })
    return updated
  })
}

export async function dispatchTransfer(id: string, actor: Actor) {
  assertRole(actor, [...OPERATION_ROLES])
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id },
      include: { items: { include: { lots: true } } },
    })
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND')
    if (transfer.status !== 'APPROVED') throw new Error('TRANSFER_INVALID_STATE')
    await assertBranchAccess(tx, actor, transfer.originBranchId)

    for (const item of transfer.items) {
      const quantity = item.approvedQuantity > 0 ? item.approvedQuantity : item.requestedQuantity
      const lots = await getAvailableLots(item.productId, transfer.originBranchId, tx)
      const allocation = calculateFefoConsumption(lots, quantity)

      await tx.transferLot.deleteMany({ where: { transferItemId: item.id } })
      for (const entry of allocation) {
        await tx.transferLot.create({
          data: {
            transferItemId: item.id,
            inventoryLotId: entry.lotId,
            plannedQuantity: entry.quantity,
            dispatchedQuantity: entry.quantity,
          },
        })
      }
      await tx.transferItem.update({
        where: { id: item.id },
        data: { dispatchedQuantity: quantity },
      })
    }

    const updated = await tx.transfer.update({
      where: { id },
      data: { status: 'IN_TRANSIT', dispatchedById: actor.id, dispatchedAt: new Date() },
    })
    await writeAudit(tx, {
      userId: actor.id,
      action: 'TRANSFER_DISPATCHED',
      entityType: 'Transfer',
      entityId: id,
      newData: { status: updated.status },
    })
    return updated
  })
}

export async function receiveTransfer(id: string, actor: Actor, input: ReceiveTransferInput) {
  assertRole(actor, [...OPERATION_ROLES])
  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const processed = await tx.auditLog.findUnique({
        where: { idempotencyKey: `receive:${input.idempotencyKey}` },
      })
      if (processed) return tx.transfer.findUnique({ where: { id } })
    }

    const transfer = await tx.transfer.findUnique({
      where: { id },
      include: { items: { include: { lots: { include: { inventoryLot: true } } } } },
    })
    if (!transfer) throw new Error('TRANSFER_NOT_FOUND')
    if (!['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(transfer.status)) {
      throw new Error('TRANSFER_INVALID_STATE')
    }
    await assertBranchAccess(tx, actor, transfer.destinationBranchId)

    const decisions = new Map(input.items.map((item) => [item.productId, item]))
    let totalReceived = 0

    for (const item of transfer.items) {
      const decision = decisions.get(item.productId)
      if (!decision) continue

      const remaining = item.dispatchedQuantity - item.receivedQuantity
      if (!Number.isInteger(decision.receivedQuantity) || decision.receivedQuantity <= 0) {
        throw new Error('INVALID_QUANTITY')
      }
      if (decision.receivedQuantity > remaining) throw new Error('QUANTITY_EXCEEDS_DISPATCH')

      let pending = decision.receivedQuantity
      const orderedLots = [...item.lots].sort((a, b) =>
        a.inventoryLot.expirationDate.getTime() - b.inventoryLot.expirationDate.getTime(),
      )

      for (const lot of orderedLots) {
        if (pending <= 0) break
        const lotRemaining = lot.plannedQuantity - lot.receivedQuantity
        if (lotRemaining <= 0) continue
        const take = Math.min(lotRemaining, pending)

        const decrement = await tx.inventoryLot.updateMany({
          where: { id: lot.inventoryLotId, quantity: { gte: take } },
          data: { quantity: { decrement: take } },
        })
        if (decrement.count !== 1) throw new Error('STOCK_CONCURRENCY_CONFLICT')

        const sourceLot = await tx.inventoryLot.findUnique({ where: { id: lot.inventoryLotId } })
        if (!sourceLot) throw new Error('LOT_NOT_FOUND')

        let destinationLotNumber = sourceLot.lotNumber
        let destinationLot = await tx.inventoryLot.findUnique({
          where: {
            productId_branchId_lotNumber: {
              productId: item.productId,
              branchId: transfer.destinationBranchId,
              lotNumber: destinationLotNumber,
            },
          },
        })
        if (destinationLot && destinationLot.expirationDate.getTime() !== sourceLot.expirationDate.getTime()) {
          destinationLotNumber = `${sourceLot.lotNumber}-${sourceLot.expirationDate.toISOString().slice(0, 10)}`
          destinationLot = await tx.inventoryLot.findUnique({
            where: {
              productId_branchId_lotNumber: {
                productId: item.productId,
                branchId: transfer.destinationBranchId,
                lotNumber: destinationLotNumber,
              },
            },
          })
        }

        if (destinationLot) {
          destinationLot = await tx.inventoryLot.update({
            where: { id: destinationLot.id },
            data: { quantity: { increment: take } },
          })
        } else {
          destinationLot = await tx.inventoryLot.create({
            data: {
              productId: item.productId,
              branchId: transfer.destinationBranchId,
              lotNumber: destinationLotNumber,
              quantity: take,
              expirationDate: sourceLot.expirationDate,
            },
          })
        }

        await tx.transferLot.update({
          where: { id: lot.id },
          data: { receivedQuantity: { increment: take }, receivedLotId: destinationLot.id },
        })

        await tx.inventoryMovement.createMany({
          data: [
            {
              productId: item.productId,
              branchId: transfer.originBranchId,
              lotId: sourceLot.id,
              type: MovementType.TRANSFER_OUT,
              quantity: take,
              reason: `Transferencia ${transfer.code}`,
              referenceId: transfer.id,
              userId: actor.id,
            },
            {
              productId: item.productId,
              branchId: transfer.destinationBranchId,
              lotId: destinationLot.id,
              type: MovementType.TRANSFER_IN,
              quantity: take,
              reason: `Transferencia ${transfer.code}`,
              referenceId: transfer.id,
              userId: actor.id,
            },
          ],
        })

        pending -= take
      }

      if (pending > 0) throw new Error('INSUFFICIENT_DISPATCHED_LOTS')
      await tx.transferItem.update({
        where: { id: item.id },
        data: { receivedQuantity: { increment: decision.receivedQuantity } },
      })
      totalReceived += decision.receivedQuantity
    }

    if (totalReceived === 0) throw new Error('EMPTY_RECEIPT')

    const refreshed = await tx.transfer.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!refreshed) throw new Error('TRANSFER_NOT_FOUND')

    const allReceived = refreshed.items.every((item) => item.receivedQuantity >= item.dispatchedQuantity)
    const updated = await tx.transfer.update({
      where: { id },
      data: {
        status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedById: actor.id,
        receivedAt: new Date(),
        notes: input.notes ?? transfer.notes,
      },
    })

    await writeAudit(tx, {
      userId: actor.id,
      action: 'TRANSFER_RECEIVED',
      entityType: 'Transfer',
      entityId: id,
      previousData: { status: transfer.status },
      newData: { status: updated.status, totalReceived },
      idempotencyKey: input.idempotencyKey ? `receive:${input.idempotencyKey}` : undefined,
    })

    return updated
  })
}

export async function getTransferableStockByProduct(branchId: string) {
  const products = await prisma.product.findMany({ where: { active: true } })
  return Promise.all(products.map(async (product) => ({
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    quantity: await getTransferableStock(product.id, branchId),
  })))
}

export async function getExpiringLotsForBranch(branchId: string, days = 30) {
  const limit = new Date()
  limit.setDate(limit.getDate() + days)
  return prisma.inventoryLot.findMany({
    where: {
      branchId,
      quantity: { gt: 0 },
      expirationDate: { gte: startOfDay(), lte: limit },
    },
    include: { product: true },
    orderBy: { expirationDate: 'asc' },
  })
}
