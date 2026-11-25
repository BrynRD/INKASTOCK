import { prisma } from '@/lib/prisma'
import { buildOperationPdf } from '@/services/pdf.service'
import { storeDocument } from '@/services/document.service'
import { sendEmail } from '@/services/email.service'
import {
  inlineKeyboard,
  isTelegramConfigured,
  sendTelegramDocument,
  sendTelegramMessage,
} from '@/services/telegram.service'
import { notifyOperation } from '@/services/notification-center.service'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function appUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}${path}`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(value)
}

function formatJson(value: unknown) {
  if (!value || typeof value !== 'object') return 'Sin evidencia adicional'
  return JSON.stringify(value, null, 2).slice(0, 700)
}

async function deliverPdf(input: {
  operationType: 'TRANSFER' | 'REPLENISHMENT'
  operationId: string
  fileName: string
  subject: string
  recipient?: string
  html: string
  text: string
  pdf: Uint8Array
  idempotencyKey: string
}) {
  const document = await storeDocument({
    operationType: input.operationType,
    operationId: input.operationId,
    fileName: input.fileName,
    bytes: input.pdf,
    idempotencyKey: `doc:${input.idempotencyKey}`,
  })

  if (input.recipient) {
    await sendEmail({
      operationType: input.operationType,
      operationId: input.operationId,
      to: input.recipient,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: [{
        filename: `${input.fileName}.pdf`,
        content: Buffer.from(input.pdf).toString('base64'),
        content_type: 'application/pdf',
      }],
      idempotencyKey: `email:${input.idempotencyKey}`,
    })
  }

  return document
}

export async function notifyOperationFailure(operationType: string, operationId: string, error: string) {
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  if (!chatId || !isTelegramConfigured()) return
  await sendTelegramMessage(
    chatId,
    `<b>Fallo de integración</b>\n${escapeHtml(operationType)} ${escapeHtml(operationId)}\n${escapeHtml(error)}\n\nReintenta manualmente desde el dashboard.`,
  )
}

export async function notifyTransferCreated(transferId: string) {
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      originBranch: true,
      destinationBranch: true,
      requestedBy: { select: { email: true, name: true } },
      items: { include: { product: true } },
    },
  })
  if (!transfer) return null

  const pdf = await buildOperationPdf({
    title: 'Solicitud de transferencia entre sucursales',
    subtitle: `Generada el ${formatDate(transfer.createdAt)}`,
    code: transfer.code,
    sections: [
      {
        title: 'Ruta',
        lines: [
          ['Origen', transfer.originBranch.name],
          ['Destino', transfer.destinationBranch.name],
          ['Estado', transfer.status],
          ['Solicitado por', transfer.requestedBy?.email ?? transfer.requestedById ?? 'No disponible'],
        ],
      },
      {
        title: 'Productos',
        lines: transfer.items.map((item) => [
          item.product.name,
          `${item.requestedQuantity} ${item.product.unit} (SKU ${item.product.sku})`,
        ]),
      },
      {
        title: 'Evidencia',
        lines: [
          ['Observaciones', transfer.notes ?? 'Sin observaciones'],
          ['Datos', formatJson(transfer.evidence)],
        ],
      },
    ],
  })

  const recipient = transfer.originBranch.notificationEmail ?? process.env.RESEND_DEFAULT_TO
  const link = appUrl(`/dashboard/transfers/${transfer.id}`)

  try {
    await deliverPdf({
      operationType: 'TRANSFER',
      operationId: transfer.id,
      fileName: `${transfer.code}-solicitud`,
      subject: `Transferencia ${transfer.code} requiere confirmación de origen`,
      recipient,
      html: `<p>Se propuso una transferencia de <b>${escapeHtml(transfer.originBranch.name)}</b> a <b>${escapeHtml(transfer.destinationBranch.name)}</b>.</p><p><a href="${link}">Revisar y confirmar en InkaStock</a></p><p>El stock no se modifica hasta la recepción.</p>`,
      text: `Transferencia ${transfer.code}. Revisar en ${link}`,
      pdf,
      idempotencyKey: `transfer-create:${transfer.id}`,
    })
  } catch (error) {
    await notifyOperationFailure('TRANSFER', transfer.id, error instanceof Error ? error.message : 'EMAIL_ERROR')
  }

  try {
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: transfer.requestedById ?? '',
      operationType: 'Transfer',
      operationId: transfer.id,
      title: `Transferencia ${transfer.code} creada`,
      body: `Nueva transferencia de ${transfer.originBranch.name} a ${transfer.destinationBranch.name}.`,
      link: `/dashboard/transfers/${transfer.id}`,
      branchIds: [transfer.originBranchId, transfer.destinationBranchId],
    })
  } catch {}

  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  if (chatId && isTelegramConfigured()) {
    await sendTelegramMessage(
      chatId,
      `<b>Transferencia ${escapeHtml(transfer.code)}</b>\n${escapeHtml(transfer.originBranch.name)} → ${escapeHtml(transfer.destinationBranch.name)}\n${transfer.items.map((item) => `${escapeHtml(item.product.name)}: ${item.requestedQuantity}`).join('\n')}\n\nConfirma que el origen tiene stock disponible.`,
      inlineKeyboard([
        [
          { text: 'Confirmar origen', callback_data: `transfer_confirm:${transfer.id}` },
          { text: 'Rechazar', callback_data: `transfer_reject:${transfer.id}` },
        ],
        [{ text: 'Abrir en InkaStock', url: link }],
      ]),
    )
    await sendTelegramDocument(chatId, pdf, `${transfer.code}.pdf`, `Expediente ${transfer.code}`)
  }

  return transfer
}

export async function notifyReplenishmentCreated(replenishmentId: string) {
  const replenishment = await prisma.replenishment.findUnique({
    where: { id: replenishmentId },
    include: { product: true, branch: true },
  })
  if (!replenishment) return null

  const pdf = await buildOperationPdf({
    title: 'Solicitud de reposición inteligente',
    subtitle: `Generada el ${formatDate(replenishment.requestedAt)}`,
    code: replenishment.code,
    sections: [
      {
        title: 'Sucursal y producto',
        lines: [
          ['Sucursal', replenishment.branch.name],
          ['Producto', `${replenishment.product.name} (SKU ${replenishment.product.sku})`],
          ['Cantidad solicitada', String(replenishment.requestedQuantity)],
          ['Motivo', replenishment.reason ?? 'Stock por debajo del objetivo'],
        ],
      },
      {
        title: 'Cálculo y evidencia',
        lines: [
          ['Cantidad sugerida', String((replenishment.evidence as { suggestedQuantity?: number } | null)?.suggestedQuantity ?? 0)],
          ['Datos', formatJson(replenishment.evidence)],
        ],
      },
    ],
  })

  const recipient = process.env.RESEND_SUPPLY_EMAIL ?? process.env.RESEND_DEFAULT_TO
  const link = appUrl(`/dashboard/replenishments/${replenishment.id}`)

  try {
    await deliverPdf({
      operationType: 'REPLENISHMENT',
      operationId: replenishment.id,
      fileName: `${replenishment.code}-solicitud`,
      subject: `Reposición ${replenishment.code} pendiente de revisión`,
      recipient,
      html: `<p>Se generó la reposición <b>${escapeHtml(replenishment.code)}</b> para <b>${escapeHtml(replenishment.branch.name)}</b>.</p><p><a href="${link}">Revisar en InkaStock</a></p><p>La aprobación no modifica inventario; el stock cambia solo al recepcionar.</p>`,
      text: `Reposición ${replenishment.code}. Revisar en ${link}`,
      pdf,
      idempotencyKey: `replenishment-create:${replenishment.id}`,
    })
  } catch (error) {
    await notifyOperationFailure('REPLENISHMENT', replenishment.id, error instanceof Error ? error.message : 'EMAIL_ERROR')
  }

  try {
    await notifyOperation(prisma, {
      channel: 'WEB',
      actorId: replenishment.requestedById ?? '',
      operationType: 'Replenishment',
      operationId: replenishment.id,
      title: `Reposición ${replenishment.code} creada`,
      body: `Nueva reposición para ${replenishment.branch.name}.`,
      link: `/dashboard/replenishments/${replenishment.id}`,
      branchIds: [replenishment.branchId],
    })
  } catch {}

  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  if (chatId && isTelegramConfigured()) {
    await sendTelegramMessage(
      chatId,
      `<b>Reposición ${escapeHtml(replenishment.code)}</b>\n${escapeHtml(replenishment.branch.name)}\n${escapeHtml(replenishment.product.name)}: ${replenishment.requestedQuantity} ${escapeHtml(replenishment.product.unit)}\n\nRevisa la solicitud antes de ordenar la compra.`,
      inlineKeyboard([
        [
          { text: 'Aprobar', callback_data: `replenishment_approve:${replenishment.id}` },
          { text: 'Rechazar', callback_data: `replenishment_reject:${replenishment.id}` },
        ],
        [{ text: 'Abrir en InkaStock', url: link }],
      ]),
    )
    await sendTelegramDocument(chatId, pdf, `${replenishment.code}.pdf`, `Expediente ${replenishment.code}`)
  }

  return replenishment
}
