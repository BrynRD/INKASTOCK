import { z } from 'zod'

export const replenishmentCreateSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  requestedQuantity: z.number().int().min(1),
  reason: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1).optional(),
})

export const replenishmentReceiveSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lots: z.array(z.object({
    lotNumber: z.string().min(1),
    expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    quantity: z.number().int().min(1),
  })).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
})

export type ReplenishmentCreateInput = z.infer<typeof replenishmentCreateSchema>
export type ReplenishmentReceiveInput = z.infer<typeof replenishmentReceiveSchema>
