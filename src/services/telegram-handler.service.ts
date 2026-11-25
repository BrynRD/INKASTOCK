import { createHash, randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { Actor } from '@/lib/actor'
import { writeAudit } from '@/services/audit.service'
import {
  answerTelegramCallback,
  editTelegramMessage,
  inlineKeyboard,
  sendTelegramMessage,
  type TelegramUpdate,
  type TelegramUser,
} from '@/services/telegram.service'
import { authorizeTransfer, confirmTransferOrigin, dispatchTransfer, rejectTransfer } from '@/services/transfer.service'
import {
  approveReplenishment,
  authorizeReplenishment,
  markReplenishmentOrdered,
  rejectReplenishment,
} from '@/services/replenishment.service'
import { notifyReplenishmentCreated } from '@/services/notification.service'
import { notifyOperation } from '@/services/notification-center.service'

function hashLinkCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export async function createTelegramLinkCode(userId: string) {
  const code = String(randomInt(100000, 1000000))
  const ttlMinutes = Number(process.env.TELEGRAM_LINK_CODE_TTL_MINUTES ?? 10)
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

  await prisma.telegramLinkCode.create({
    data: { codeHash: hashLinkCode(code), userId, expiresAt },
  })

  return { code, expiresAt }
}

async function linkTelegramAccount(telegramUser: TelegramUser, chatId: string, code: string) {
  const link = await prisma.telegramLinkCode.findUnique({
    where: { codeHash: hashLinkCode(code) },
    include: { user: true },
  })

  if (!link || link.usedAt || link.expiresAt < new Date()) {
    await sendTelegramMessage(chatId, 'El código no es válido o venció. Genera uno nuevo en InkaStock.')
    return
  }
  if (!link.user.active) {
    await sendTelegramMessage(chatId, 'Tu usuario de InkaStock está inactivo.')
    return
  }

  const telegramUserId = String(telegramUser.id)
  const existing = await prisma.telegramAccount.findUnique({ where: { telegramUserId } })
  if (existing && existing.userId !== link.userId) {
    await sendTelegramMessage(chatId, 'Este chat ya está vinculado a otro usuario.')
    return
  }

  await prisma.$transaction([
    prisma.telegramLinkCode.update({ where: { id: link.id }, data: { usedAt: new Date() } }),
    prisma.telegramAccount.upsert({
      where: { userId: link.userId },
      create: {
        userId: link.userId,
        telegramUserId,
        telegramChatId: chatId,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      },
      update: {
        telegramUserId,
        telegramChatId: chatId,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        active: true,
        lastInteractionAt: new Date(),
      },
    }),
  ])

  await sendTelegramMessage(
    chatId,
    `Cuenta vinculada como <b>${link.user.name}</b> (${link.user.role}). Ya puedes aprobar operaciones desde este chat.`,
  )
}

async function resolveTelegramActor(telegramUserId: string) {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramUserId },
    include: { user: true },
  })
  if (!account?.active || !account.user.active) throw new Error('TELEGRAM_NOT_LINKED')

  const actor: Actor = {
    id: account.user.id,
    role: account.user.role,
    email: account.user.email,
    name: account.user.name,
  }
  return { actor, chatId: account.telegramChatId }
}

async function handleCommand(update: TelegramUpdate) {
  const message = update.message
  if (!message?.text) return

  const chatId = String(message.chat.id)
  const from = message.from
  const text = message.text.trim()
  const command = text.split(/\s+/)[0].split('@')[0]

  if (!from) return

  if (command === '/start') {
    await sendTelegramMessage(
      chatId,
      'Hola. Soy el asistente de aprobaciones de InkaStock. Genera un código en *Configuración* y envíame:\n\n<code>/vincular 123456</code>',
    )
    return
  }

  if (command === '/ayuda') {
    await sendTelegramMessage(
      chatId,
      'Comandos:\n/vincular CODIGO — vincula tu cuenta\n/ayuda — muestra esta ayuda\n\nLas aprobaciones llegan como botones en este chat.',
    )
    return
  }

  if (command === '/vincular') {
    const code = text.split(/\s+/)[1]
    if (!code) {
      await sendTelegramMessage(chatId, 'Envía el comando con el código: <code>/vincular 123456</code>')
      return
    }
    await linkTelegramAccount(from, chatId, code)
    return
  }

  await sendTelegramMessage(chatId, 'No entiendo ese comando. Usa /ayuda.')
}

async function handleCallback(update: TelegramUpdate) {
  const callback = update.callback_query
  if (!callback?.data) return

  const callbackId = callback.id
  const [action, id] = callback.data.split(':')
  if (!id) {
    await answerTelegramCallback(callbackId, 'Acción inválida')
    return
  }

  try {
    const { actor, chatId } = await resolveTelegramActor(String(callback.from.id))
    await prisma.telegramAccount.update({
      where: { telegramUserId: String(callback.from.id) },
      data: { lastInteractionAt: new Date() },
    })

    let target: { code: string; status: string }
    let message: string

    switch (action) {
      case 'transfer_authorize':
        target = await authorizeTransfer(id, actor)
        message = `Transferencia ${target.code} autorizada. Falta confirmación del origen.`
        break
      case 'transfer_confirm':
        target = await confirmTransferOrigin(id, actor, {})
        message = `Transferencia ${target.code} confirmada por origen. Ya se puede despachar.`
        break
      case 'transfer_dispatch':
        target = await dispatchTransfer(id, actor)
        message = `Transferencia ${target.code} despachada. El stock se ajustará al recepcionar.`
        break
      case 'transfer_reject':
        target = await rejectTransfer(id, actor, 'Rechazada desde Telegram')
        message = `Transferencia ${target.code} rechazada.`
        break
      case 'replenishment_authorize':
        target = await authorizeReplenishment(id, actor)
        await notifyReplenishmentCreated(id)
        message = `Reposición ${target.code} autorizada y enviada a abastecimiento.`
        break
      case 'replenishment_approve':
        target = await approveReplenishment(id, actor)
        message = `Reposición ${target.code} aprobada. El inventario no se modifica hasta la recepción.`
        break
      case 'replenishment_order':
        target = await markReplenishmentOrdered(id, actor)
        message = `Reposición ${target.code} marcada como ordenada.`
        break
      case 'replenishment_reject':
        target = await rejectReplenishment(id, actor, 'Rechazada desde Telegram')
        message = `Reposición ${target.code} rechazada.`
        break
      default:
        await answerTelegramCallback(callbackId, 'Acción desconocida')
        return
    }

    const operationType = action.startsWith('transfer_') ? 'Transfer' : 'Replenishment'
    const link = operationType === 'Transfer' ? `/dashboard/transfers/${id}` : `/dashboard/replenishments/${id}`
    await notifyOperation(prisma, {
      channel: 'TELEGRAM',
      actorId: actor.id,
      operationType,
      operationId: id,
      title: `Desde Telegram: ${action}`,
      body: message,
      link,
    })

    const messageId = callback.message?.message_id
    if (messageId) {
      await editTelegramMessage(chatId, messageId, message, inlineKeyboard([]))
    } else {
      await sendTelegramMessage(chatId, message)
    }
    await answerTelegramCallback(callbackId, 'Registrado')
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ERROR'
    await answerTelegramCallback(callbackId, 'No se pudo procesar')
    await sendTelegramMessage(
      String(callback.from.id),
      `No pude procesar la acción (${code}). Verifica tu vinculación y permisos.`,
    )
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const auditKey = `telegram-update:${update.update_id}`
  const processed = await prisma.auditLog.findUnique({ where: { idempotencyKey: auditKey } })
  if (processed) return

  const allowedChat = process.env.TELEGRAM_ALLOWED_CHAT_ID
  const incomingChat = update.message?.chat.id ?? update.callback_query?.message?.chat.id
  if (allowedChat && incomingChat !== undefined && String(incomingChat) !== allowedChat) {
    if (update.callback_query) await answerTelegramCallback(update.callback_query.id, 'Chat no autorizado')
    return
  }

  if (update.message) await handleCommand(update)
  if (update.callback_query) await handleCallback(update)

  await writeAudit(prisma, {
    action: 'TELEGRAM_UPDATE',
    entityType: 'Telegram',
    entityId: String(update.update_id),
    newData: { update },
    idempotencyKey: auditKey,
  })
}
