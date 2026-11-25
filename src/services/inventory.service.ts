import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import {
  calculateFefoConsumption,
  startOfDay,
  type FefoConsumption,
} from '@/lib/inventory-logic'

export { startOfDay, daysUntilExpiration, type FefoConsumption } from '@/lib/inventory-logic'

type DbClient = Prisma.TransactionClient

export async function getAvailableLots(productId: string, branchId: string, client: DbClient = prisma) {
  return client.inventoryLot.findMany({
    where: {
      productId,
      branchId,
      quantity: { gt: 0 },
      expirationDate: { gte: startOfDay() },
    },
    orderBy: { expirationDate: 'asc' },
  })
}

export async function getStockByProductBranch(productId: string, branchId: string, client: DbClient = prisma) {
  const lots = await client.inventoryLot.findMany({
    where: {
      productId,
      branchId,
      quantity: { gt: 0 },
      expirationDate: { gte: startOfDay() },
    },
    select: { quantity: true },
  })

  return lots.reduce((total, lot) => total + lot.quantity, 0)
}

export async function getLotsWithProduct(productId: string, branchId: string) {
  return prisma.inventoryLot.findMany({
    where: { productId, branchId },
    include: { product: true },
    orderBy: { expirationDate: 'asc' },
  })
}

export async function planFefo(
  client: DbClient,
  productId: string,
  branchId: string,
  quantity: number,
): Promise<FefoConsumption[]> {
  const lots = await getAvailableLots(productId, branchId, client)
  const consumption = calculateFefoConsumption(lots, quantity)

  for (const item of consumption) {
    const result = await client.inventoryLot.updateMany({
      where: { id: item.lotId, quantity: { gte: item.quantity } },
      data: { quantity: { decrement: item.quantity } },
    })

    if (result.count !== 1) {
      throw new Error('STOCK_CONCURRENCY_CONFLICT')
    }
  }

  return consumption
}

export async function consumeFefo(productId: string, branchId: string, quantity: number): Promise<FefoConsumption[]> {
  return prisma.$transaction((tx) => planFefo(tx, productId, branchId, quantity))
}
