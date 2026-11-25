import {
  buildReportFileName,
  generateReportCsv,
  generateReportPdf,
  type ReportData,
  type ReportFormat,
} from '@/lib/report-format'
import { getCriticalAlerts } from '@/services/automation.service'
import { getAuthorizedReplenishments, getPendingTransfers } from '@/services/integration.service'

export type ReportExportPayload = {
  generatedAt: string
  counts: { alerts: number; transfers: number; replenishments: number }
  pdf?: { fileName: string; contentType: string; base64: string }
  csv?: { fileName: string; contentType: string; base64: string }
}

export async function buildReportData(): Promise<ReportData> {
  const [alertsResult, transfers, replenishments] = await Promise.all([
    getCriticalAlerts(undefined, 100),
    getPendingTransfers(),
    getAuthorizedReplenishments(),
  ])

  return {
    generatedAt: alertsResult.generatedAt,
    alerts: alertsResult.alerts.map((alert) => ({
      id: alert.id,
      product: alert.product,
      sku: alert.sku,
      branch: alert.branch,
      type: alert.type,
      priority: alert.priority,
      stock: alert.stock,
      minimumStock: alert.minimumStock,
      message: alert.message,
    })),
    transfers: transfers.map((transfer) => ({
      code: transfer.code,
      origin: transfer.originBranch.name,
      destination: transfer.destinationBranch.name,
      status: transfer.status,
      createdAt: transfer.createdAt,
      items: transfer.items.map((item) => ({
        product: item.product.name,
        sku: item.product.sku,
        requested: item.requestedQuantity,
        approved: item.approvedQuantity,
        dispatched: item.dispatchedQuantity,
        received: item.receivedQuantity,
      })),
    })),
    replenishments: replenishments.map((replenishment) => ({
      code: replenishment.code,
      product: replenishment.product.name,
      sku: replenishment.product.sku,
      branch: replenishment.branch.name,
      status: replenishment.status,
      requested: replenishment.requestedQuantity,
      received: replenishment.receivedQuantity,
      reason: replenishment.reason ?? '',
      requestedAt: replenishment.requestedAt,
    })),
  }
}

export async function generateReportExport(
  formats: ReportFormat[],
): Promise<ReportExportPayload> {
  const data = await buildReportData()

  const payload: ReportExportPayload = {
    generatedAt: data.generatedAt,
    counts: {
      alerts: data.alerts.length,
      transfers: data.transfers.length,
      replenishments: data.replenishments.length,
    },
  }

  if (formats.includes('pdf')) {
    const bytes = await generateReportPdf(data)
    payload.pdf = {
      fileName: buildReportFileName('pdf'),
      contentType: 'application/pdf',
      base64: Buffer.from(bytes).toString('base64'),
    }
  }

  if (formats.includes('csv')) {
    const csv = generateReportCsv(data)
    payload.csv = {
      fileName: buildReportFileName('csv'),
      contentType: 'text/csv; charset=utf-8',
      base64: Buffer.from(csv, 'utf8').toString('base64'),
    }
  }

  return payload
}
