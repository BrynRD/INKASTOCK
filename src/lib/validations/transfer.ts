import { z } from 'zod'

export const transferCreateSchema = z.object({
  originBranchId: z.string().uuid(),
  destinationBranchId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    requestedQuantity: z.number().int().min(1),
  })).min(1),
  notes: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1).optional(),
}).refine((value) => value.originBranchId !== value.destinationBranchId, {
  message: 'Las sucursales de origen y destino deben ser distintas',
  path: ['destinationBranchId'],
})

export const transferConfirmSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    approvedQuantity: z.number().int().min(1),
  })).optional(),
  notes: z.string().optional(),
})

export const transferReceiveSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    receivedQuantity: z.number().int().min(1),
  })).min(1),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
})

export const transferRecommendSchema = z.object({
  productId: z.string().uuid(),
  destinationBranchId: z.string().uuid(),
})

export type TransferCreatePayload = z.infer<typeof transferCreateSchema>
export type TransferReceivePayload = z.infer<typeof transferReceiveSchema>
