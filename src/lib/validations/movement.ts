import { z } from 'zod'
import { MovementType } from '@/generated/prisma/enums'

export const movementCreateSchema = z
  .object({
    productId: z.string().uuid(),
    branchId: z.string().uuid(),
    type: z.nativeEnum(MovementType),
    quantity: z.number().int().min(1),
    lotId: z.string().uuid().optional(),
    lotNumber: z.string().min(1).optional(),
    expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    reason: z.string().optional(),
    referenceId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  })
  .refine((value) => value.type !== 'ENTRY' || value.lotId || (value.lotNumber && value.expirationDate), {
    message: 'Se requiere lotId o lotNumber y expirationDate para entradas',
  })

export type MovementCreateInput = z.infer<typeof movementCreateSchema>
