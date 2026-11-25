import type { UserRole } from '@/generated/prisma/enums'
import type { Prisma } from '@/generated/prisma/client'

export type Actor = {
  id: string
  role: UserRole
  email?: string
  name?: string
}

export type DbClient = Prisma.TransactionClient

export type JsonRecord = Record<string, unknown>
