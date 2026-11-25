import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { productCreateSchema, productUpdateSchema } from '@/lib/validations/product'
import type { ProductCreateInput, ProductUpdateInput } from '@/lib/validations/product'

function parseExpirationDate(value: string | undefined): Date | undefined {
  if (!value) return undefined

  // Soporta DD/MM/YYYY y YYYY-MM-DD
  const trimmed = value.trim()
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/')
    if (parts.length === 3) {
      const day = Number(parts[0])
      const month = Number(parts[1])
      const year = Number(parts[2])
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day)
      }
    }
  }

  return new Date(trimmed)
}

function slugify(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12)
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

async function generateUniqueSku(name: string): Promise<string> {
  const base = slugify(name) || 'PROD'
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomSuffix()}`
    const exists = await prisma.product.findUnique({ where: { sku: candidate } })
    if (!exists) return candidate
  }
  return `${base}-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

export async function createProduct(data: ProductCreateInput) {
  const { initialQuantity, initialBranchId, expirationDate, lotNumber, ...productData } = data

  const sku = productData.sku ?? (await generateUniqueSku(productData.name))
  const productDataWithSku = { ...productData, sku }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: productDataWithSku,
    })

    if (initialQuantity && initialQuantity > 0 && initialBranchId) {
      const lotData: Record<string, unknown> = {
        productId: product.id,
        branchId: initialBranchId,
        lotNumber: lotNumber ?? `LOT-${Date.now()}`,
        quantity: initialQuantity,
      }
      const parsedDate = parseExpirationDate(expirationDate)
      if (parsedDate) {
        lotData.expirationDate = parsedDate
      }

      await tx.inventoryLot.create({ data: lotData as Prisma.InventoryLotCreateInput })
    }

    return product
  })
}

export async function listProducts(params: {
  search?: string
  category?: string
  page?: number
  pageSize?: number
}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Prisma.ProductWhereInput = {}

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { sku: { contains: params.search, mode: 'insensitive' } },
      { barcode: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  if (params.category) {
    where.category = params.category
  }

  const [data, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    }),
    prisma.product.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({ where: { id } })
}

export async function updateProduct(id: string, data: ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data })
}

export async function deactivateProduct(id: string) {
  return prisma.product.update({ where: { id }, data: { active: false } })
}

export const productServiceValidators = {
  productCreateSchema,
  productUpdateSchema,
}
