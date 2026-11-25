import { describe, expect, it } from 'vitest'
import { movementCreateSchema } from '@/lib/validations/movement'

const productId = '00000000-0000-4000-8000-000000000001'
const branchId = '00000000-0000-4000-8000-000000000002'

describe('movementCreateSchema', () => {
  it('exige datos de lote para una entrada', () => {
    const result = movementCreateSchema.safeParse({
      productId,
      branchId,
      type: 'ENTRY',
      quantity: 10,
    })

    expect(result.success).toBe(false)
  })

  it('acepta una entrada con lote nuevo y vencimiento real', () => {
    const result = movementCreateSchema.safeParse({
      productId,
      branchId,
      type: 'ENTRY',
      quantity: 10,
      lotNumber: 'LOT-2026-001',
      expirationDate: '2027-01-01',
    })

    expect(result.success).toBe(true)
  })

  it('rechaza cantidades menores a uno', () => {
    const result = movementCreateSchema.safeParse({
      productId,
      branchId,
      type: 'EXIT',
      quantity: 0,
      lotNumber: 'LOT-2026-001',
      expirationDate: '2027-01-01',
    })

    expect(result.success).toBe(false)
  })
})
