import type { ReplenishmentStatus } from '@/generated/prisma/enums'
import { errorResponse, isOpenRpaAuthorized, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

const DEFAULT_STATUSES: ReplenishmentStatus[] = ['REQUESTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED']

export async function GET(request: Request) {
  if (!isOpenRpaAuthorized(request)) return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const statuses = statusParam
    ? statusParam.split(',').filter(Boolean) as ReplenishmentStatus[]
    : DEFAULT_STATUSES

  const replenishments = await prisma.replenishment.findMany({
    where: { status: { in: statuses } },
    include: {
      product: true,
      branch: true,
      items: true,
      documents: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { requestedAt: 'asc' },
    take: 100,
  })

  return successResponse(replenishments)
}
