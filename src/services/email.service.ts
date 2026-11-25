import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export type EmailAttachment = {
  filename: string
  content: string
  content_type?: string
}

export type SendEmailInput = {
  operationType: string
  operationId: string
  to: string
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  idempotencyKey?: string
}

type ResendResponse = {
  id?: string
  message?: string
  name?: string
}

export async function sendEmail(input: SendEmailInput) {
  const idempotencyKey = input.idempotencyKey ?? randomUUID()
  const existing = await prisma.emailLog.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  const apiKey = process.env.RESEND_API_KEY
  const mode = process.env.RESEND_MODE ?? (apiKey ? 'real' : 'dry_run')

  if (mode !== 'real' || !apiKey) {
    return prisma.emailLog.create({
      data: {
        operationType: input.operationType,
        operationId: input.operationId,
        recipient: input.to,
        subject: input.subject,
        status: 'DRY_RUN',
        idempotencyKey,
      },
    })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? 'InkaStock <onboarding@resend.dev>',
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
      }),
    })

    const payload = (await response.json()) as ResendResponse
    if (!response.ok) {
      throw new Error(payload.message ?? payload.name ?? 'RESEND_ERROR')
    }

    return prisma.emailLog.create({
      data: {
        operationType: input.operationType,
        operationId: input.operationId,
        recipient: input.to,
        subject: input.subject,
        providerMessageId: payload.id,
        status: 'SENT',
        idempotencyKey,
      },
    })
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        operationType: input.operationType,
        operationId: input.operationId,
        recipient: input.to,
        subject: input.subject,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'RESEND_ERROR',
        idempotencyKey,
      },
    })
    throw error
  }
}
