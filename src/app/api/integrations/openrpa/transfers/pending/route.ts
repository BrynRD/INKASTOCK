import type { TransferStatus } from '@/generated/prisma/enums'
import { errorResponse, isOpenRpaAuthorized, successResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

const DEFAULT_STATUSES: TransferStatus[] = [
  'PENDING_ORIGIN_CONFIRMATION',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
]

export async function GET(request: Request) {
  if (!isOpenRpaAuthorized(request)) return errorResponse(401, 'UNAUTHORIZED', 'No autorizado')

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const statuses = statusParam
    ? statusParam.split(',').filter(Boolean) as TransferStatus[]
    : DEFAULT_STATUSES

  const transfers = await prisma.transfer.findMany({
    where: { status: { in: statuses } },
    include: {
      originBranch: true,
      destinationBranch: true,
      items: { include: { product: true } },
      documents: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  return successResponse(transfers)
}
