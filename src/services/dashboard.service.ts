import { prisma } from '@/lib/prisma'
import { startOfDay } from '@/services/inventory.service'
import { AlertStatus, AlertPriority, AlertType } from '@/generated/prisma/enums'

export async function getDashboardKpis() {
  const totalProducts = await prisma.product.count()
  const totalBranches = await prisma.branch.count()
  const totalLots = await prisma.inventoryLot.count()
  const pendingAlerts = await prisma.alert.count({ where: { status: AlertStatus.PENDING } })
  const criticalAlerts = await prisma.alert.count({ where: { status: AlertStatus.PENDING, priority: AlertPriority.CRITICAL } })
  const expiredAlerts = await prisma.alert.count({ where: { status: AlertStatus.PENDING, type: AlertType.EXPIRED } })
  const lowStockAlerts = await prisma.alert.count({ where: { status: AlertStatus.PENDING, type: AlertType.STOCK_LOW } })
  const pendingReplenishments = await prisma.replenishment.count({ where: { status: 'PENDING' } })

  const activeLots = await prisma.inventoryLot.findMany({
    where: { quantity: { gt: 0 }, expirationDate: { gte: startOfDay() } },
    select: { quantity: true },
  })
  const availableUnits = activeLots.reduce((total, lot) => total + lot.quantity, 0)

  const expiringSoon = await prisma.inventoryLot.findMany({
    where: { quantity: { gt: 0 }, expirationDate: { gte: startOfDay(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
    include: { product: true, branch: true },
    orderBy: { expirationDate: 'asc' },
    take: 10,
  })

  const recentMovements = await prisma.inventoryMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { product: true, branch: true },
  })

  const recentAlerts = await prisma.alert.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { product: true, branch: true },
  })

  const recentReplenishments = await prisma.replenishment.findMany({
    orderBy: { requestedAt: 'desc' },
    take: 8,
    include: { product: true, branch: true },
  })

  const recentExecutions = await prisma.automationLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 8,
  })

  return {
    totalProducts,
    totalBranches,
    totalLots,
    pendingAlerts,
    criticalAlerts,
    expiredAlerts,
    lowStockAlerts,
    pendingReplenishments,
    availableUnits,
    expiringSoon,
    recentMovements,
    recentAlerts,
    recentReplenishments,
    recentExecutions,
  }
}
