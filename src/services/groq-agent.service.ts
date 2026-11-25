import { z } from 'zod'
import type { ReplenishmentStatus, TransferStatus } from '@/generated/prisma/enums'
import type { Actor } from '@/lib/actor'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getStockByProductBranch } from '@/services/inventory.service'
import { recommendTransfer } from '@/services/transfer.service'
import { suggestReplenishmentQuantity } from '@/services/replenishment.service'

const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1'
const AGENT_MODEL = process.env.GROQ_AGENT_MODEL ?? 'qwen/qwen3.8-27b'
const MAX_STEPS = Number(process.env.GROQ_MAX_STEPS ?? 6)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const resolveSchema = z.object({ query: z.string().min(1) })
const listAlertsSchema = z.object({
  status: z.enum(['PENDING', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  limit: z.number().int().min(1).max(20).default(10),
})
const listOperationsSchema = z.object({
  type: z.enum(['transfer', 'replenishment']),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(10),
})

type ToolResult = {
  summary: string
  data: unknown
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'resolve_product',
      description: 'Resuelve un producto por nombre, SKU o id.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_stock',
      description: 'Obtiene el stock disponible de un producto en una sucursal.',
      parameters: {
        type: 'object',
        properties: { productQuery: { type: 'string' }, branchQuery: { type: 'string' } },
        required: ['productQuery', 'branchQuery'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_alerts',
      description: 'Lista alertas de inventario recientes.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'ACKNOWLEDGED', 'RESOLVED'] },
          limit: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_replenishment',
      description: 'Calcula la cantidad sugerida de reposición sin crear la orden.',
      parameters: {
        type: 'object',
        properties: { productQuery: { type: 'string' }, branchQuery: { type: 'string' } },
        required: ['productQuery', 'branchQuery'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_transfer',
      description: 'Recomienda redistribuir stock entre sucursales sin crear la transferencia.',
      parameters: {
        type: 'object',
        properties: { productQuery: { type: 'string' }, destinationBranchQuery: { type: 'string' } },
        required: ['productQuery', 'destinationBranchQuery'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_operations',
      description: 'Lista transferencias o reposiciones recientes.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['transfer', 'replenishment'] },
          status: { type: 'string' },
          limit: { type: 'integer' },
        },
        required: ['type'],
      },
    },
  },
]

async function resolveProduct(query: string) {
  const normalized = query.trim()
  const filters: Prisma.ProductWhereInput[] = [
    { sku: { equals: normalized, mode: 'insensitive' } },
    { barcode: { equals: normalized, mode: 'insensitive' } },
    { name: { contains: normalized, mode: 'insensitive' } },
  ]
  if (UUID_PATTERN.test(normalized)) filters.unshift({ id: normalized })

  const product = await prisma.product.findFirst({
    where: { active: true, OR: filters },
  })
  if (!product) throw new Error(`No encontré el producto "${query}".`)
  return product
}

async function resolveBranch(query: string) {
  const normalized = query.trim()
  const filters: Prisma.BranchWhereInput[] = [
    { code: { equals: normalized, mode: 'insensitive' } },
    { name: { contains: normalized, mode: 'insensitive' } },
  ]
  if (UUID_PATTERN.test(normalized)) filters.unshift({ id: normalized })

  const branch = await prisma.branch.findFirst({
    where: { active: true, OR: filters },
  })
  if (!branch) throw new Error(`No encontré la sucursal "${query}".`)
  return branch
}

async function executeTool(name: string, rawArgs: string): Promise<ToolResult> {
  if (name === 'resolve_product') {
    const args = resolveSchema.parse(JSON.parse(rawArgs))
    const product = await resolveProduct(args.query)
    return { summary: `Producto resuelto: ${product.name}`, data: product }
  }

  if (name === 'get_product_stock') {
    const args = z.object({ productQuery: z.string(), branchQuery: z.string() }).parse(JSON.parse(rawArgs))
    const [product, branch] = await Promise.all([
      resolveProduct(args.productQuery),
      resolveBranch(args.branchQuery),
    ])
    const stock = await getStockByProductBranch(product.id, branch.id)
    return {
      summary: `${product.name} tiene ${stock} unidades en ${branch.name}.`,
      data: { product, branch, stock },
    }
  }

  if (name === 'list_alerts') {
    const args = listAlertsSchema.parse(JSON.parse(rawArgs))
    const alerts = await prisma.alert.findMany({
      where: args.status ? { status: args.status } : undefined,
      include: { product: true, branch: true },
      orderBy: { createdAt: 'desc' },
      take: args.limit,
    })
    return { summary: `Se encontraron ${alerts.length} alertas.`, data: alerts }
  }

  if (name === 'recommend_replenishment') {
    const args = z.object({ productQuery: z.string(), branchQuery: z.string() }).parse(JSON.parse(rawArgs))
    const [product, branch] = await Promise.all([
      resolveProduct(args.productQuery),
      resolveBranch(args.branchQuery),
    ])
    const suggestion = await suggestReplenishmentQuantity(product.id, branch.id)
    return {
      summary: `Reposición sugerida: ${suggestion.suggestedQuantity} unidades en ${branch.name}.`,
      data: suggestion,
    }
  }

  if (name === 'recommend_transfer') {
    const args = z.object({ productQuery: z.string(), destinationBranchQuery: z.string() }).parse(JSON.parse(rawArgs))
    const [product, branch] = await Promise.all([
      resolveProduct(args.productQuery),
      resolveBranch(args.destinationBranchQuery),
    ])
    const recommendation = await recommendTransfer(product.id, branch.id)
    return {
      summary: recommendation.recommendedQuantity > 0
        ? `Se pueden transferir ${recommendation.recommendedQuantity} unidades desde ${recommendation.candidates[0]?.branchName ?? 'otra sucursal'}.`
        : 'No hay stock transferible suficiente.',
      data: recommendation,
    }
  }

  if (name === 'list_operations') {
    const args = listOperationsSchema.parse(JSON.parse(rawArgs))
    const transferWhere = args.status ? { status: args.status as TransferStatus } : undefined
    if (args.type === 'transfer') {
      const rows = await prisma.transfer.findMany({
        where: transferWhere,
        include: { originBranch: true, destinationBranch: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: args.limit,
      })
      return { summary: `Se encontraron ${rows.length} transferencias.`, data: rows }
    }
    const replenishmentWhere = args.status ? { status: args.status as ReplenishmentStatus } : undefined
    const rows = await prisma.replenishment.findMany({
      where: replenishmentWhere,
      include: { product: true, branch: true },
      orderBy: { requestedAt: 'desc' },
      take: args.limit,
    })
    return { summary: `Se encontraron ${rows.length} reposiciones.`, data: rows }
  }

  throw new Error(`Herramienta desconocida: ${name}`)
}

async function deterministicInvestigation(input: { message: string; actor: Actor; productId?: string }) {
  const product = input.productId
    ? await prisma.product.findUnique({ where: { id: input.productId } })
    : await prisma.product.findFirst({ where: { active: true }, orderBy: { name: 'asc' } })

  if (!product) throw new Error('NO_PRODUCTS')

  const branches = await prisma.branch.findMany({ where: { active: true } })
  const stockRows = await Promise.all(branches.map(async (branch) => ({
    branch,
    stock: await getStockByProductBranch(product.id, branch.id),
  })))

  const lowest = [...stockRows].sort((a, b) => a.stock - b.stock)[0]
  if (!lowest) throw new Error('NO_BRANCHES')

  const wantsTransfer = /transfer|redistrib|traslad|env/i.test(input.message)
  const replenishment = await suggestReplenishmentQuantity(product.id, lowest.branch.id)
  const donor = [...stockRows].sort((a, b) => b.stock - a.stock)[0]
  const transfer = donor && donor.branch.id !== lowest.branch.id
    ? await recommendTransfer(product.id, lowest.branch.id)
    : null

  const evidence = {
    product,
    stockByBranch: stockRows.map((row) => ({
      branchId: row.branch.id,
      branchName: row.branch.name,
      stock: row.stock,
    })),
    replenishment,
    transfer,
  }

  if (wantsTransfer && transfer && transfer.recommendedQuantity > 0 && transfer.candidates[0]) {
    return {
      answer: `Para ${product.name}, ${lowest.branch.name} tiene ${lowest.stock} unidades. El origen con mayor excedente es ${transfer.candidates[0].branchName}. Se recomienda transferir ${transfer.recommendedQuantity} unidades. El stock solo cambiará al recepcionar.`,
      evidence,
      recommendation: {
        type: 'TRANSFER' as const,
        payload: {
          originBranchId: transfer.candidates[0].branchId,
          destinationBranchId: lowest.branch.id,
          items: [{ productId: product.id, requestedQuantity: transfer.recommendedQuantity }],
          reason: input.message,
        },
      },
    }
  }

  return {
    answer: `Para ${product.name}, ${lowest.branch.name} tiene ${lowest.stock} unidades y el objetivo configurado es ${replenishment.targetStock}. La cantidad sugerida de reposición es ${replenishment.suggestedQuantity}, descontando solicitudes abiertas y transferencias en curso. La aprobación no modifica inventario.`,
    evidence,
    recommendation: {
      type: 'REPLENISHMENT' as const,
      payload: {
        productId: product.id,
        branchId: lowest.branch.id,
        requestedQuantity: Math.max(1, replenishment.suggestedQuantity),
        reason: input.message,
      },
    },
  }
}

export async function investigate(input: { message: string; actor: Actor; productId?: string }) {
  const baseline = await deterministicInvestigation(input)
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    return { ...baseline, toolsUsed: [] as string[], model: 'deterministic', demoData: true }
  }

  try {
    const messages: Array<Record<string, unknown>> = [
      {
        role: 'system',
        content: 'Eres el investigador de inventario de InkaStock. Responde en español, de forma precisa y breve. Usa herramientas solo para leer datos; nunca modifiques inventario ni ejecutes acciones. Indica que son datos simulados cuando aplique. Si falta información, dilo.',
      },
      {
        role: 'user',
        content: `${input.message}\n\nContexto inicial: ${JSON.stringify(baseline.evidence).slice(0, 3500)}`,
      },
    ]
    const toolsUsed: string[] = []

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: AGENT_MODEL,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 900,
        }),
        signal: AbortSignal.timeout(30000),
      })
      const payload = (await response.json()) as {
        choices?: Array<{ message?: Record<string, unknown> }>
        error?: { message?: string }
      }
      if (!response.ok) throw new Error(payload.error?.message ?? 'GROQ_AGENT_ERROR')

      const assistantMessage = payload.choices?.[0]?.message
      if (!assistantMessage) throw new Error('GROQ_AGENT_EMPTY_RESPONSE')

      const toolCalls = (assistantMessage.tool_calls ?? []) as Array<{
        id: string
        function: { name: string; arguments: string }
      }>

      if (toolCalls.length === 0) {
        const content = typeof assistantMessage.content === 'string' ? assistantMessage.content.trim() : ''
        return {
          answer: content || baseline.answer,
          evidence: baseline.evidence,
          recommendation: baseline.recommendation,
          toolsUsed,
          model: AGENT_MODEL,
          demoData: true,
        }
      }

      messages.push(assistantMessage)
      for (const call of toolCalls) {
        toolsUsed.push(call.function.name)
        let result: ToolResult
        try {
          result = await executeTool(call.function.name, call.function.arguments)
        } catch (error) {
          result = {
            summary: error instanceof Error ? error.message : 'ERROR_DE_HERRAMIENTA',
            data: null,
          }
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        })
      }
    }

    return { ...baseline, toolsUsed, model: AGENT_MODEL, demoData: true }
  } catch {
    return { ...baseline, toolsUsed: [] as string[], model: 'deterministic', demoData: true }
  }
}
