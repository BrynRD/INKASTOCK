import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { AlertStatus, AlertPriority } from '@/generated/prisma/enums'
import { getStockByProductBranch } from '@/services/inventory.service'

export async function checkHealth() {
  return { success: true, application: 'InkaStock', status: 'online' }
}

export async function getCriticalAlerts(branchId?: string, limit = 50) {
  const where: Record<string, unknown> = {
    status: AlertStatus.PENDING,
    priority: AlertPriority.CRITICAL,
  }

  if (branchId) where.branchId = branchId

  const alerts = await prisma.alert.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { product: true, branch: true },
  })

  const enriched = await Promise.all(
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
        product: alert.product.name,
        sku: alert.product.sku,
        branch: alert.branch.name,
        stock,
        minimumStock: settings?.minimumStock ?? 0,
        message: alert.message,
      }
    }),
  )

  return {
    total: enriched.length,
    generatedAt: new Date().toISOString(),
    alerts: enriched,
  }
}

export async function startExecution(input: { executionId: string; workflowName: string }) {
  const execution = await prisma.automationLog.create({
    data: {
      executionId: input.executionId,
      workflowName: input.workflowName,
      status: 'RUNNING',
      alertsFound: 0,
    },
  })

  return execution
}

export async function finishExecution(input: {
  executionId: string
  status: 'SUCCESS' | 'FAILED'
  alertsFound?: number
  details?: Record<string, unknown>
}) {
  const execution = await prisma.automationLog.findUnique({ where: { executionId: input.executionId } })

  if (!execution) {
    throw new Error('EXECUTION_NOT_FOUND')
  }

  const updated = await prisma.automationLog.update({
    where: { executionId: input.executionId },
    data: {
      status: input.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      alertsFound: input.alertsFound ?? execution.alertsFound,
      finishedAt: new Date(),
      details: (input.details ?? execution.details ?? undefined) as Prisma.InputJsonValue,
    },
  })

  return updated
}

export async function listExecutions(limit = 20) {
  const executions = await prisma.automationLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  })

  return { executions }
}
