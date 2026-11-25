import { prisma } from '@/lib/prisma'
import { daysUntilExpiration, startOfDay } from '@/services/inventory.service'
import { AlertStatus, AlertType, AlertPriority } from '@/generated/prisma/enums'

export async function listAlerts(params: {
  status?: AlertStatus
  priority?: AlertPriority
  type?: AlertType
  branchId?: string
  productId?: string
  page?: number
  pageSize?: number
}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Record<string, unknown> = {}

  if (params.status) where.status = params.status
  if (params.priority) where.priority = params.priority
  if (params.type) where.type = params.type
  if (params.branchId) where.branchId = params.branchId
  if (params.productId) where.productId = params.productId

  const [data, total] = await prisma.$transaction([
    prisma.alert.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { product: true, branch: true },
    }),
    prisma.alert.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function getAlertById(id: string) {
  return prisma.alert.findUnique({ where: { id } })
}

export async function updateAlertStatus(id: string, status: AlertStatus) {
  const alert = await prisma.alert.update({
    where: { id },
    data: { status, resolvedAt: status === AlertStatus.RESOLVED ? new Date() : null },
  })

  return alert
}

export async function detectAlerts(): Promise<number> {
  const branches = await prisma.branch.findMany({ where: { active: true } })
  let created = 0

  for (const branch of branches) {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { settings: true },
    })

    for (const product of products) {
      const settings = product.settings.find((s) => s.branchId === branch.id)
      const stock = await getStockByProductBranchSafe(product.id, branch.id)

      const outOfStockFingerprint = `STOCK:${product.id}:${branch.id}:OUT_OF_STOCK`

      if (stock === 0) {
        const existing = await prisma.alert.findUnique({ where: { fingerprint: outOfStockFingerprint } })
        if (!existing) {
          await prisma.alert.create({
            data: {
              productId: product.id,
              branchId: branch.id,
              type: AlertType.OUT_OF_STOCK,
              priority: AlertPriority.CRITICAL,
              message: `Producto ${product.name} sin stock disponible en ${branch.name}`,
              status: AlertStatus.PENDING,
              fingerprint: outOfStockFingerprint,
            },
          })
          created += 1
        }
      } else if (settings && stock <= settings.minimumStock) {
        const fingerprint = `STOCK:${product.id}:${branch.id}:LOW`
        const existing = await prisma.alert.findUnique({ where: { fingerprint } })
        if (!existing) {
          await prisma.alert.create({
            data: {
              productId: product.id,
              branchId: branch.id,
              type: AlertType.STOCK_LOW,
              priority: stock <= Math.max(1, settings.minimumStock / 2) ? AlertPriority.HIGH : AlertPriority.MEDIUM,
              message: `Producto ${product.name} con stock ${stock} por debajo del mínimo ${settings.minimumStock} en ${branch.name}`,
              status: AlertStatus.PENDING,
              fingerprint,
            },
          })
          created += 1
        }
      }

      const lots = await prisma.inventoryLot.findMany({
        where: { productId: product.id, branchId: branch.id, quantity: { gt: 0 } },
        orderBy: { expirationDate: 'asc' },
      })

      for (const lot of lots) {
        const days = daysUntilExpiration(lot.expirationDate)

        let type: AlertType
        let priority: AlertPriority

        if (days < 0) {
          type = AlertType.EXPIRED
          priority = AlertPriority.CRITICAL
        } else if (days <= 7) {
          type = AlertType.EXPIRING
          priority = AlertPriority.CRITICAL
        } else if (days <= 30) {
          type = AlertType.EXPIRING
          priority = AlertPriority.HIGH
        } else if (days <= 60) {
          type = AlertType.EXPIRING
          priority = AlertPriority.MEDIUM
        } else {
          continue
        }

        const fingerprint = `EXP:${lot.id}`
        const existing = await prisma.alert.findUnique({ where: { fingerprint } })
        if (!existing) {
          await prisma.alert.create({
            data: {
              productId: product.id,
              branchId: branch.id,
              lotId: lot.id,
              type,
              priority,
              message: `Lote ${lot.lotNumber} de ${product.name} vence en ${days} días (fecha: ${lot.expirationDate.toISOString().slice(0, 10)})`,
              status: AlertStatus.PENDING,
              fingerprint,
            },
          })
          created += 1
        }
      }
    }
  }

  return created
}

async function getStockByProductBranchSafe(productId: string, branchId: string) {
  const lots = await prisma.inventoryLot.findMany({
    where: { productId, branchId, quantity: { gt: 0 }, expirationDate: { gte: startOfDay() } },
    select: { quantity: true },
  })
  return lots.reduce((total, lot) => total + lot.quantity, 0)
}
