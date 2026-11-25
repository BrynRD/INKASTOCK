import { prisma } from '@/lib/prisma'

export async function listLots(params: { branchId?: string; productId?: string; page?: number; pageSize?: number }) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Record<string, unknown> = {}

  if (params.branchId) where.branchId = params.branchId
  if (params.productId) where.productId = params.productId

  const [data, total] = await prisma.$transaction([
    prisma.inventoryLot.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { expirationDate: 'asc' },
      include: { product: true },
    }),
    prisma.inventoryLot.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function createLot(data: {
  productId: string
  branchId: string
  lotNumber: string
  quantity: number
  expirationDate: string
}) {
  const lot = await prisma.inventoryLot.create({
    data: {
      productId: data.productId,
      branchId: data.branchId,
      lotNumber: data.lotNumber,
      quantity: data.quantity,
      expirationDate: new Date(data.expirationDate),
    },
  })

  return lot
}
