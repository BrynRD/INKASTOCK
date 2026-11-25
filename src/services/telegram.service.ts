import { timingSafeEqual } from 'node:crypto'

const TELEGRAM_API = 'https://api.telegram.org/bot'

export type TelegramUser = {
  id: number
  is_bot?: boolean
  first_name: string
  last_name?: string
  username?: string
}

export type TelegramMessage = {
  message_id: number
  chat: { id: number; title?: string; username?: string }
  from?: TelegramUser
  text?: string
  date: number
}

export type TelegramCallbackQuery = {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export type TelegramKeyboardButton = {
  text: string
  callback_data?: string
  url?: string
}

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN
}

export function isTelegramConfigured() {
  return Boolean(getToken())
}

export function assertTelegramConfigured() {
  const token = getToken()
  if (!token) throw new Error('TELEGRAM_NOT_CONFIGURED')
  return token
}

export function verifyTelegramSecret(header: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return false
  if (!header) return false

  const receivedBuffer = Buffer.from(header)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

export async function callTelegram<T = unknown>(method: string, body: unknown): Promise<T | null> {
  const token = getToken()
  if (!token) return null

  const response = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as { ok?: boolean; result?: T; description?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? 'TELEGRAM_ERROR')
  }
  return payload.result ?? null
}

export function inlineKeyboard(rows: TelegramKeyboardButton[][]) {
  return {
    inline_keyboard: rows.map((row) =>
      row.map((button) =>
        button.url
          ? { text: button.text, url: button.url }
          : { text: button.text, callback_data: button.callback_data ?? 'noop' },
      ),
    ),
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: ReturnType<typeof inlineKeyboard>,
) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export async function answerTelegramCallback(callbackQueryId: string, text?: string) {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  })
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: ReturnType<typeof inlineKeyboard>,
) {
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export async function sendTelegramDocument(
  chatId: string,
  bytes: Uint8Array,
  fileName: string,
  caption?: string,
) {
  const token = getToken()
  if (!token) return null

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('document', new Blob([buffer], { type: 'application/pdf' }), fileName)
  if (caption) form.append('caption', caption)

  const response = await fetch(`${TELEGRAM_API}${token}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  const payload = (await response.json()) as { ok?: boolean; description?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? 'TELEGRAM_ERROR')
  }
  return payload
}

export async function configureTelegramWebhook() {
  const token = assertTelegramConfigured()
  const url = process.env.TELEGRAM_WEBHOOK_URL
  if (!url) throw new Error('TELEGRAM_WEBHOOK_URL_REQUIRED')

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const [webhook, commands] = await Promise.all([
    fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        ...(secret ? { secret_token: secret } : {}),
        allowed_updates: ['message', 'callback_query'],
      }),
    }).then(async (response) => response.json()),
    fetch(`${TELEGRAM_API}${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Iniciar y vincular tu cuenta' },
          { command: 'vincular', description: 'Vincular cuenta con código' },
          { command: 'ayuda', description: 'Ver ayuda' },
        ],
      }),
    }).then(async (response) => response.json()),
  ])

  return { webhook, commands }
}
