import { z } from 'zod'

export const lotCreateSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  lotNumber: z.string().min(1).max(50),
  quantity: z.number().int().min(0),
  expirationDate: z.string(),
})

export type LotCreateInput = z.infer<typeof lotCreateSchema>
