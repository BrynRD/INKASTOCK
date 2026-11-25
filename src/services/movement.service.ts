import { prisma } from '@/lib/prisma'
import { planFefo } from '@/services/inventory.service'
import { MovementType } from '@/generated/prisma/enums'

export type CreateMovementInput = {
  productId: string
  branchId: string
  type: MovementType
  quantity: number
  lotId?: string
  lotNumber?: string
  expirationDate?: string
  reason?: string
  referenceId?: string
  userId?: string
}

export async function listMovements(params: {
  productId?: string
  branchId?: string
  type?: MovementType
  page?: number
  pageSize?: number
}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Record<string, unknown> = {}

  if (params.productId) where.productId = params.productId
  if (params.branchId) where.branchId = params.branchId
  if (params.type) where.type = params.type

  const [data, total] = await prisma.$transaction([
    prisma.inventoryMovement.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { product: true, branch: true },
    }),
    prisma.inventoryMovement.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function registerEntry(input: CreateMovementInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('INVALID_QUANTITY')
  }

  return prisma.$transaction(async (tx) => {
    let lotId = input.lotId

    if (lotId) {
      const lot = await tx.inventoryLot.findUnique({ where: { id: lotId } })

      if (!lot || lot.productId !== input.productId || lot.branchId !== input.branchId) {
        throw new Error('LOT_BRANCH_PRODUCT_MISMATCH')
      }

      await tx.inventoryLot.update({
        where: { id: lotId },
        data: { quantity: { increment: input.quantity } },
      })
    } else {
      if (!input.lotNumber || !input.expirationDate) {
        throw new Error('LOT_DATA_REQUIRED')
      }

      const lot = await tx.inventoryLot.create({
        data: {
          productId: input.productId,
          branchId: input.branchId,
          lotNumber: input.lotNumber,
          quantity: input.quantity,
          expirationDate: new Date(`${input.expirationDate}T00:00:00.000Z`),
        },
      })
      lotId = lot.id
    }

    return tx.inventoryMovement.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        lotId,
        type: MovementType.ENTRY,
        quantity: input.quantity,
        reason: input.reason,
        referenceId: input.referenceId,
        userId: input.userId,
      },
    })
  })
}

export async function registerExit(input: CreateMovementInput) {
  return prisma.$transaction(async (tx) => {
    const consumption = await planFefo(tx, input.productId, input.branchId, input.quantity)

    return tx.inventoryMovement.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        lotId: consumption[0]?.lotId,
        type: MovementType.EXIT,
        quantity: input.quantity,
        reason: input.reason,
        referenceId: input.referenceId,
        userId: input.userId,
      },
    })
  })
}

export async function registerAdjustment(input: CreateMovementInput & { lotId: string }) {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new Error('INVALID_QUANTITY')
  }

  return prisma.$transaction(async (tx) => {
    const lot = await tx.inventoryLot.findUnique({ where: { id: input.lotId } })

    if (!lot || lot.productId !== input.productId || lot.branchId !== input.branchId) {
      throw new Error('LOT_BRANCH_PRODUCT_MISMATCH')
    }

    await tx.inventoryLot.update({
      where: { id: lot.id },
      data: { quantity: input.quantity },
    })

    return tx.inventoryMovement.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        lotId: lot.id,
        type: MovementType.ADJUSTMENT,
        quantity: input.quantity,
        reason: input.reason,
        userId: input.userId,
      },
    })
  })
}
