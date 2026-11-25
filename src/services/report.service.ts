import { prisma } from '@/lib/prisma'
import { getStockByProductBranch } from '@/services/inventory.service'

const REPORT_DIRECTORY = process.env.REPORT_DIRECTORY ?? 'reports'

export function generateAlertsCsv(alerts: Array<{
  id: string
  type: string
  priority: string
  productName: string
  sku: string
  branchName: string
  stock: number
  minimumStock: number
  message: string
  createdAt: Date
}>) {
  const header = [
    'ID',
    'Producto',
    'SKU',
    'Sucursal',
    'Tipo',
    'Prioridad',
    'Stock',
    'Stock mínimo',
    'Mensaje',
    'Fecha',
  ]

  const rows = alerts.map((alert) => [
    alert.id,
    alert.productName,
    alert.sku,
    alert.branchName,
    alert.type,
    alert.priority,
    String(alert.stock),
    String(alert.minimumStock),
    alert.message,
    alert.createdAt.toISOString(),
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  return csv
}

export function buildReportFileName() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `InkaStock_Alerts_${datePart}_${timePart}.csv`
}

export async function generateAlertsReport() {
  const alerts = await prisma.alert.findMany({
    where: { status: 'PENDING', priority: 'CRITICAL' },
    include: { product: true, branch: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const rows = await Promise.all(
    alerts.map(async (alert) => {
      const [stock, settings] = await Promise.all([
        getStockByProductBranch(alert.productId, alert.branchId),
        prisma.inventorySettings.findUnique({
          where: {
            productId_branchId: {
              productId: alert.productId,
              branchId: alert.branchId,
            },
          },
        }),
      ])

      return {
        id: alert.id,
        type: alert.type,
        priority: alert.priority,
        productName: alert.product.name,
        sku: alert.product.sku,
        branchName: alert.branch.name,
        stock,
        minimumStock: settings?.minimumStock ?? 0,
        message: alert.message,
        createdAt: alert.createdAt,
      }
    }),
  )

  const csv = generateAlertsCsv(rows)

  const directory = REPORT_DIRECTORY
  return { fileName: buildReportFileName(), csv, directory, alertsCount: alerts.length }
}
