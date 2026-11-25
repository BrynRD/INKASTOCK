import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'

export type OperationDocumentType = 'TRANSFER' | 'REPLENISHMENT'

function documentsDirectory() {
  return path.resolve(process.env.REPORT_DIRECTORY ?? 'reports', 'documents')
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function storeDocument(input: {
  operationType: OperationDocumentType
  operationId: string
  fileName: string
  bytes: Uint8Array
  idempotencyKey?: string
}) {
  const directory = documentsDirectory()
  await mkdir(directory, { recursive: true })

  const fileName = safeFileName(input.fileName)
  const storagePath = path.join(directory, `${input.operationType}-${input.operationId}-${fileName}`)
  await writeFile(storagePath, input.bytes)

  const sha256 = createHash('sha256').update(input.bytes).digest('hex')

  return prisma.document.upsert({
    where: {
      operationType_operationId_fileName: {
        operationType: input.operationType,
        operationId: input.operationId,
        fileName,
      },
    },
    create: {
      operationType: input.operationType,
      operationId: input.operationId,
      transferId: input.operationType === 'TRANSFER' ? input.operationId : null,
      replenishmentId:
        input.operationType === 'REPLENISHMENT' ? input.operationId : null,
      fileName,
      mimeType: 'application/pdf',
      storagePath,
      size: input.bytes.byteLength,
      sha256,
      idempotencyKey: input.idempotencyKey,
    },
    update: {
      storagePath,
      size: input.bytes.byteLength,
      sha256,
    },
  })
}

export async function getLatestDocument(operationType: OperationDocumentType, operationId: string) {
  return prisma.document.findFirst({
    where: { operationType, operationId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function readDocumentFile(storagePath: string) {
  return readFile(storagePath)
}
