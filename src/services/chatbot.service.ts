import { prisma } from '@/lib/prisma'
import { startOfDay } from '@/services/inventory.service'
import { AlertType, AlertPriority } from '@/generated/prisma/enums'

export type ChatIntent =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'PRODUCT_STOCK'
  | 'PRODUCT_INFO'
  | 'INVENTORY_SUMMARY'
  | 'BRANCH_COMPARISON'
  | 'REPLENISHMENT'
  | 'UNKNOWN'

const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1'
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b'
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS ?? 30000)

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function classifyIntent(message: string): ChatIntent {
  const normalized = stripAccents(message.toLowerCase())

  if (
    normalized.includes('cuantos productos') ||
    normalized.includes('cuantos productos hay') ||
    normalized.includes('cuantos productos tenemos') ||
    normalized.includes('total de productos') ||
    normalized.includes('numero de productos') ||
    normalized.includes('numero total de productos') ||
    normalized.includes('resumen de inventario') ||
    normalized.includes('resumen del inventario')
  ) {
    return 'INVENTORY_SUMMARY'
  }
  if (normalized.includes('agot') || normalized.includes('sin stock') || normalized.includes('out of stock')) {
    return 'OUT_OF_STOCK'
  }
  if (normalized.includes('por agotarse') || normalized.includes('stock bajo') || normalized.includes('bajo') || normalized.includes('critical')) {
    return 'LOW_STOCK'
  }
  if (normalized.includes('vencen') || normalized.includes('vence') || normalized.includes('expirar') || normalized.includes('expir')) {
    return 'EXPIRING'
  }
  if (normalized.includes('stock') || normalized.includes('existencia') || normalized.includes('disponible') || normalized.includes('cantidad') || normalized.includes('cuanto') || normalized.includes('cuantos') || normalized.includes('hay')) {
    return 'PRODUCT_STOCK'
  }
  if (normalized.includes('reposici') || normalized.includes('reponer') || normalized.includes('reorder')) {
    return 'REPLENISHMENT'
  }
  if (
    normalized.includes('que es') ||
    normalized.includes('qué es') ||
    normalized.includes('definicion') ||
    normalized.includes('definición') ||
    normalized.includes('descripcion') ||
    normalized.includes('descripción') ||
    normalized.includes('para que sirve') ||
    normalized.includes('para qué sirve') ||
    normalized.includes('informacion de') ||
    normalized.includes('información de') ||
    normalized.includes('detalles de')
  ) {
    return 'PRODUCT_INFO'
  }
  if (normalized.includes('sucursal') || normalized.includes('sucursales') || normalized.includes('branch')) {
    return 'BRANCH_COMPARISON'
  }
  if (normalized.includes('resumen') || normalized.includes('inventario') || normalized.includes('cuantos productos') || normalized.includes('cuántos productos') || normalized.includes('total de productos') || normalized.includes('cuántos')) {
    return 'INVENTORY_SUMMARY'
  }

  return 'UNKNOWN'
}

export async function getInventorySummary() {
  const [products, branches, lots, pendingAlerts, criticalAlerts, expiringSoon, movements] = await Promise.all([
    prisma.product.count(),
    prisma.branch.count(),
    prisma.inventoryLot.count(),
    prisma.alert.count({ where: { status: 'PENDING' } }),
    prisma.alert.findMany({
      where: { status: 'PENDING', priority: AlertPriority.CRITICAL },
      include: { product: true, branch: true },
    }),
    prisma.inventoryLot.findMany({
      where: { quantity: { gt: 0 }, expirationDate: { gte: startOfDay(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      include: { product: true, branch: true },
      orderBy: { expirationDate: 'asc' },
      take: 10,
    }),
    prisma.inventoryMovement.count(),
  ])

  return { products, branches, lots, pendingAlerts, criticalAlerts, expiringSoon, movements }
}

async function answerLowStock(): Promise<string> {
  const low = await prisma.alert.findMany({
    where: { status: 'PENDING', type: AlertType.STOCK_LOW },
    include: { product: true, branch: true },
    take: 20,
  })

  if (low.length === 0) {
    return 'No hay productos con stock bajo en el momento.'
  }

  return low.map((a) => `${a.product.name} en ${a.branch.name}: ${a.message}`).join(' | ')
}

async function answerOutOfStock(): Promise<string> {
  const outOfStock = await prisma.alert.findMany({
    where: { status: 'PENDING', type: AlertType.OUT_OF_STOCK },
    include: { product: true, branch: true },
    take: 20,
  })

  if (outOfStock.length === 0) {
    return 'No hay productos agotados actualmente.'
  }

  return outOfStock.map((a) => `${a.product.name} en ${a.branch.name}: ${a.message}`).join(' | ')
}

async function answerExpiring(): Promise<string> {
  const expiring = await prisma.inventoryLot.findMany({
    where: { quantity: { gt: 0 }, expirationDate: { gte: startOfDay(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
    include: { product: true, branch: true },
    orderBy: { expirationDate: 'asc' },
    take: 20,
  })

  if (expiring.length === 0) {
    return 'No hay productos próximos a vencer en los próximos 30 días.'
  }

  return expiring.map((l) => `${l.product.name} - Lote ${l.lotNumber} en ${l.branch.name} vence el ${l.expirationDate.toISOString().slice(0, 10)}`).join(' | ')
}

async function getStockByProductBranchSafe(productId: string, branchId: string) {
  const lots = await prisma.inventoryLot.findMany({
    where: { productId, branchId, quantity: { gt: 0 }, expirationDate: { gte: startOfDay() } },
    select: { quantity: true },
  })
  return lots.reduce((total, lot) => total + lot.quantity, 0)
}

async function answerProductStock(message: string): Promise<string> {
  const normalized = stripAccents(message.toLowerCase())

  const stopWords = [
    'cuanto', 'cuantos', 'cuanta', 'cuantas', 'cuántos', 'cuánta', 'hay',
    'en', 'el', 'la', 'los', 'las', 'inventario', 'stock', 'disponible',
    'de', 'un', 'una', 'producto', 'productos', 'tenemos', 'tengo', 'tiene',
    'tienen', 'cantidad', 'existencia',
  ]

  const words = normalized
    .replace(/[¿?¡!.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w))

  const productName = words.join(' ').trim()
  if (!productName) {
    return 'Dime el nombre del producto (por ejemplo: paracetamol, ibuprofeno) para consultar su stock.'
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: productName, mode: 'insensitive' } },
        { sku: { contains: productName, mode: 'insensitive' } },
      ],
    },
  })

  if (products.length === 0) {
    return `No encontré información de productos para "${productName}".`
  }

  const lines: string[] = []
  for (const product of products) {
    const branches = await prisma.branch.findMany({ where: { active: true } })
    for (const branch of branches) {
      const stock = await getStockByProductBranchSafe(product.id, branch.id)
      lines.push(`${product.name} en ${branch.name}: ${stock} unidades`)
    }
  }

  return lines.join(' | ')
}

async function answerProductInfo(message: string): Promise<string> {
  const normalized = stripAccents(message.toLowerCase())

  const stopWords = [
    'que', 'que', 'es', 'definicion', 'definición', 'descripcion', 'descripción',
    'para', 'que', 'sirve', 'informacion', 'información', 'detalles', 'de',
    'el', 'la', 'los', 'las', 'un', 'una', 'producto', 'productos', 'cual',
    'cuales', 'cual es', 'cuales son', 'dime', 'dime el', 'dime la',
  ]

  const words = normalized
    .replace(/[¿?¡!.,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w))

  const productName = words.join(' ').trim()
  if (!productName) {
    return 'Dime el nombre del producto (por ejemplo: naproxeno, paracetamol) para consultar su información.'
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: productName, mode: 'insensitive' } },
        { sku: { contains: productName, mode: 'insensitive' } },
      ],
    },
  })

  if (products.length === 0) {
    return `No encontré información de productos para "${productName}".`
  }

  const lines: string[] = []
  for (const product of products) {
    lines.push(
      `${product.name} (SKU ${product.sku}) — Categoría: ${product.category}, Unidad: ${product.unit}. ${product.description ?? 'Sin descripción disponible.'}`
    )
  }

  return lines.join(' | ')
}

export async function getReply(message: string): Promise<{ reply: string; intent: ChatIntent }> {
  const intent = classifyIntent(message)
  let structuredAnswer: string
  const context: Record<string, unknown> = {}

  switch (intent) {
    case 'OUT_OF_STOCK':
      structuredAnswer = await answerOutOfStock()
      break
    case 'LOW_STOCK':
      structuredAnswer = await answerLowStock()
      break
    case 'EXPIRING':
      structuredAnswer = await answerExpiring()
      break
    case 'INVENTORY_SUMMARY': {
      const summary = await getInventorySummary()
      structuredAnswer = `Resumen: ${summary.products} productos, ${summary.branches} sucursales, ${summary.lots} lotes, ${summary.pendingAlerts} alertas pendientes y ${summary.criticalAlerts.length} críticas activas.`
      context.summary = summary
      break
    }
    case 'REPLENISHMENT': {
      const pending = await prisma.replenishment.findMany({
        where: { status: 'PENDING' },
        include: { product: true, branch: true },
        take: 20,
      })
      structuredAnswer = pending.length
        ? `${pending.length} reposiciones pendientes. ${pending.map((r) => `${r.product.name} en ${r.branch.name}: ${r.requestedQuantity}`).join(' | ')}`
        : 'No hay reposiciones pendientes.'
      break
    }
    case 'PRODUCT_INFO':
      structuredAnswer = await answerProductInfo(message)
      break
    case 'PRODUCT_STOCK':
      structuredAnswer = await answerProductStock(message)
      break
    case 'BRANCH_COMPARISON': {
      const criticalAlerts = await prisma.alert.findMany({
        where: { status: 'PENDING', priority: AlertPriority.CRITICAL },
        include: { product: true, branch: true },
        take: 50,
      })
      const byBranch = new Map<string, number>()
      for (const alert of criticalAlerts) {
        byBranch.set(alert.branchId, (byBranch.get(alert.branchId) ?? 0) + 1)
      }
      const branchNames = await Promise.all(
        Array.from(byBranch.keys()).map(async (branchId) => {
          const branch = await prisma.branch.findUnique({ where: { id: branchId } })
          return { branchId, name: branch?.name ?? branchId, criticals: byBranch.get(branchId) ?? 0 }
        }),
      )
      structuredAnswer = branchNames.length
        ? `Sucursales con más alertas críticas: ${branchNames.map((b) => `${b.name} (${b.criticals})`).join(', ')}.`
        : 'No hay alertas críticas activas.'
      break
    }
    default:
      structuredAnswer = 'No entendí tu pregunta. Puedes preguntar sobre stock, vencimientos, sucursales o reposiciones.'
  }

  // Para UNKNOWN no usamos Groq: evita que invente datos no reales
  if (intent === 'UNKNOWN') {
    return { reply: structuredAnswer, intent }
  }

  const reply = await generateAiReply(message, structuredAnswer, context)

  return { reply, intent }
}

async function generateGroqReply(message: string, structuredAnswer: string, context: Record<string, unknown>): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)

  try {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Eres el asistente de inventario de InkaStock. Responde siempre en español, de forma clara, profesional y breve. Usa solo los datos del contexto; si faltan datos, dilo.',
          },
          {
            role: 'user',
            content: `Pregunta: ${message}\nRespuesta estructurada: ${structuredAnswer}\nContexto: ${JSON.stringify(context)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: controller.signal,
    })

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content?.trim()
    return response.ok && content ? content : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function generateAiReply(message: string, structuredAnswer: string, context: Record<string, unknown>): Promise<string> {
  return (await generateGroqReply(message, structuredAnswer, context)) ?? structuredAnswer
}
