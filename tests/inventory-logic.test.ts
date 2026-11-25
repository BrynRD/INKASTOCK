import { describe, expect, it } from 'vitest'
import { calculateFefoConsumption, daysUntilExpiration } from '@/lib/inventory-logic'

describe('calculateFefoConsumption', () => {
  it('consume lotes en orden y respeta cantidades disponibles', () => {
    const result = calculateFefoConsumption(
      [
        { id: 'lote-vence-primero', quantity: 3 },
        { id: 'lote-siguiente', quantity: 10 },
      ],
      6,
    )

    expect(result).toEqual([
      { lotId: 'lote-vence-primero', quantity: 3 },
      { lotId: 'lote-siguiente', quantity: 3 },
    ])
  })

  it('rechaza salidas sin stock suficiente', () => {
    expect(() => calculateFefoConsumption([{ id: 'lote', quantity: 4 }], 5)).toThrow('INSUFFICIENT_STOCK')
  })

  it('rechaza cantidades inválidas', () => {
    expect(() => calculateFefoConsumption([{ id: 'lote', quantity: 10 }], 0)).toThrow('INVALID_QUANTITY')
  })
})

describe('daysUntilExpiration', () => {
  it('calcula días completos usando el inicio del día', () => {
    const today = new Date(2026, 0, 1, 18, 30)
    const expiration = new Date(2026, 0, 6, 7, 0)

    expect(daysUntilExpiration(expiration, today)).toBe(5)
  })
})
