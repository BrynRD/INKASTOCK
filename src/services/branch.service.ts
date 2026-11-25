import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { branchCreateSchema, branchUpdateSchema } from '@/lib/validations/branch'
import type { BranchCreateInput, BranchUpdateInput } from '@/lib/validations/branch'

export async function createBranch(data: BranchCreateInput) {
  return prisma.branch.create({ data })
}

export async function listBranches(params: { search?: string; page?: number; pageSize?: number }) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const where: Prisma.BranchWhereInput = {}

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { code: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await prisma.$transaction([
    prisma.branch.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    }),
    prisma.branch.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function getBranchById(id: string) {
  return prisma.branch.findUnique({ where: { id } })
}

export async function updateBranch(id: string, data: BranchUpdateInput) {
  return prisma.branch.update({ where: { id }, data })
}

export async function deactivateBranch(id: string) {
  return prisma.branch.update({ where: { id }, data: { active: false } })
}

export const branchServiceValidators = {
  branchCreateSchema,
  branchUpdateSchema,
}
