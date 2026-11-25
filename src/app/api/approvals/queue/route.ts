import { withApiAuth } from '@/lib/auth/api'
import { ALL_ROLES } from '@/lib/auth/permissions'
import { successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import type { ReplenishmentStatus, TransferStatus } from '@/generated/prisma/enums'

const PENDING_TRANSFER_STATUSES: TransferStatus[] = [
  'PENDING_ORIGIN_CONFIRMATION',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
]

const PENDING_REPLENISHMENT_STATUSES: ReplenishmentStatus[] = [
  'PENDING_APPROVAL',
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
]

const RESOLVED_STATUSES = ['RECEIVED', 'REJECTED', 'CANCELLED']

export const GET = withApiAuth(ALL_ROLES, async (_request, _context, user) => {
  const url = new URL(_request.url)
  const tab = url.searchParams.get('tab') ?? 'all'
  const type = url.searchParams.get('type')
  const branchId = url.searchParams.get('branchId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const search = url.searchParams.get('search')
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '100'), 1), 200)

  const transferWhere: { status: { in: TransferStatus[] }; AND: Array<Record<string, unknown>> } = {
    status: { in: PENDING_TRANSFER_STATUSES },
    AND: [],
  }
  if (search) {
    transferWhere.AND.push({
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { originBranch: { name: { contains: search, mode: 'insensitive' } } },
        { destinationBranch: { name: { contains: search, mode: 'insensitive' } } },
      ],
    })
  }
  if (branchId) {
    transferWhere.AND.push({
      OR: [{ originBranchId: branchId }, { destinationBranchId: branchId }],
    })
  }
  if (from || to) {
    transferWhere.AND.push({
      createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
    })
  }

  const replenishmentWhere: { status: { in: ReplenishmentStatus[] }; AND: Array<Record<string, unknown>> } = {
    status: { in: PENDING_REPLENISHMENT_STATUSES },
    AND: [],
  }
  if (search) {
    replenishmentWhere.AND.push({
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { branch: { name: { contains: search, mode: 'insensitive' } } },
      ],
    })
  }
  if (branchId) {
    replenishmentWhere.AND.push({ branchId })
  }
  if (from || to) {
    replenishmentWhere.AND.push({
      requestedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
    })
  }

  const [transfers, replenishments] = await Promise.all([
    prisma.transfer.findMany({
      where: transferWhere as Prisma.TransferWhereInput,
      include: {
        originBranch: true,
        destinationBranch: true,
        items: { include: { product: true } },
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.replenishment.findMany({
      where: replenishmentWhere as Prisma.ReplenishmentWhereInput,
      include: {
        product: { include: { settings: true } },
        branch: true,
        items: true,
        requestedByUser: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    }),
  ])

  const operations = [
    ...transfers.map((transfer) => {
      const item = transfer.items[0]
      const product = item?.product
      return {
        id: transfer.id,
        code: transfer.code,
        type: 'TRANSFER' as const,
        status: transfer.status,
        product: product?.name ?? 'Sin producto',
        sku: product?.sku,
        unit: product?.unit,
        branch: transfer.originBranch.name,
        destinationBranch: transfer.destinationBranch.name,
        originBranch: transfer.originBranch.name,
        destinationBranchId: transfer.destinationBranchId,
        originBranchId: transfer.originBranchId,
        quantity: item?.requestedQuantity ?? 0,
        requestedBy: transfer.requestedBy,
        requestedAt: transfer.createdAt,
        reason: transfer.notes,
        link: `/dashboard/transfers/${transfer.id}`,
        priority: 'MEDIUM',
      }
    }),
    ...replenishments.map((replenishment) => {
      const productSettings = replenishment.product?.settings ?? []
      const setting = productSettings.find((s) => s.branchId === replenishment.branchId) ?? null
      const stock = replenishment.items?.[0]?.currentStock ?? 0
      const minimumStock = setting?.minimumStock ?? 0
      return {
        id: replenishment.id,
        code: replenishment.code,
        type: 'REPLENISHMENT' as const,
        status: replenishment.status,
        product: replenishment.product?.name ?? 'Sin producto',
        sku: replenishment.product?.sku,
        unit: replenishment.product?.unit,
        branch: replenishment.branch.name,
        branchId: replenishment.branchId,
        quantity: replenishment.requestedQuantity,
        requestedBy: replenishment.requestedByUser,
        requestedAt: replenishment.requestedAt,
        reason: replenishment.reason,
        link: `/dashboard/replenishments/${replenishment.id}`,
        priority: stock === 0 ? 'HIGH' : stock < minimumStock ? 'MEDIUM' : 'LOW',
        suggestedQuantity: replenishment.items?.[0]?.requestedQuantity,
        currentStock: stock,
        minimumStock,
        targetStock: setting?.targetStock,
      }
    }),
  ].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())

  let filtered = operations
  if (type === 'transfer') filtered = filtered.filter((o) => o.type === 'TRANSFER')
  if (type === 'replenishment') filtered = filtered.filter((o) => o.type === 'REPLENISHMENT')
  if (tab === 'pending') filtered = filtered.filter((o) => !RESOLVED_STATUSES.includes(o.status))
  if (tab === 'approved') filtered = filtered.filter((o) => o.status === 'APPROVED' || o.status === 'REQUESTED' || o.status === 'ORDERED')
  if (tab === 'rejected') filtered = filtered.filter((o) => o.status === 'REJECTED')
  if (tab === 'history') filtered = filtered.filter((o) => RESOLVED_STATUSES.includes(o.status))
  if (tab === 'review') filtered = filtered.filter((o) => o.status === 'UNDER_REVIEW' || o.status === 'PENDING_ORIGIN_CONFIRMATION')

  return successResponse({ viewerRole: user.role, operations: filtered.slice(0, limit), total: filtered.length })
})
