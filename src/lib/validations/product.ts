import { z } from 'zod'

export const productCreateSchema = z.object({
  sku: z.string().min(3).max(30).optional(),
  barcode: z.string().optional(),
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  category: z.string().min(2).max(100),
  unit: z.string().min(1).max(20),
  active: z.boolean().default(true),
  initialQuantity: z.number().int().nonnegative().optional(),
  initialBranchId: z.string().optional(),
  expirationDate: z.string().optional(),
  lotNumber: z.string().min(1).max(50).optional(),
})

export const productUpdateSchema = productCreateSchema.partial()

export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
