import type { ReplenishmentStatus, TransferStatus } from '@/generated/prisma/enums'
import { prisma } from '@/lib/prisma'
import {
  getLatestDocument,
  readDocumentFile,
  type OperationDocumentType,
} from '@/services/document.service'

export const DEFAULT_PENDING_TRANSFER_STATUSES: TransferStatus[] = [
  'PENDING_ORIGIN_CONFIRMATION',
  'APPROVED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
]

export const DEFAULT_AUTHORIZED_REPLENISHMENT_STATUSES: ReplenishmentStatus[] = [
  'REQUESTED',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
]

function parseStatuses<T extends string>(value: string | null, fallback: T[]): T[] {
  if (!value) return fallback

  const statuses = value.split(',').map((status) => status.trim()).filter(Boolean) as T[]
  return statuses.length > 0 ? statuses : fallback
}

export async function getPendingTransfers(statusParam: string | null = null) {
  const statuses = parseStatuses(statusParam, DEFAULT_PENDING_TRANSFER_STATUSES)

  return prisma.transfer.findMany({
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
}

export async function getAuthorizedReplenishments(statusParam: string | null = null) {
  const statuses = parseStatuses(statusParam, DEFAULT_AUTHORIZED_REPLENISHMENT_STATUSES)

  return prisma.replenishment.findMany({
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
}

export async function getOperationDocumentPdf(
  type: OperationDocumentType,
  operationId: string,
) {
  const document = await getLatestDocument(type, operationId)
  if (!document) return null

  const contents = await readDocumentFile(document.storagePath)
  const buffer = contents.buffer.slice(
    contents.byteOffset,
    contents.byteOffset + contents.byteLength,
  ) as ArrayBuffer

  return { document, buffer }
}

export function isOperationDocumentType(value: string): value is OperationDocumentType {
  return value === 'TRANSFER' || value === 'REPLENISHMENT'
}
