import { z } from 'zod'

export const branchCreateSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(120),
  address: z.string().min(5).max(250),
  city: z.string().min(2).max(120),
  state: z.string().max(120).optional(),
  active: z.boolean().default(true),
})

export const branchUpdateSchema = branchCreateSchema.partial()

export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
