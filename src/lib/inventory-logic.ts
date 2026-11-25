export type FefoConsumption = { lotId: string; quantity: number }

export function startOfDay(date: Date = new Date()): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export function daysUntilExpiration(date: Date, today: Date = new Date()): number {
  return Math.ceil((startOfDay(date).getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24))
}

export function calculateFefoConsumption(
  lots: Array<{ id: string; quantity: number }>,
  quantity: number,
): FefoConsumption[] {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('INVALID_QUANTITY')
  }

  const consumption: FefoConsumption[] = []
  let remaining = quantity

  for (const lot of lots) {
    if (remaining <= 0) break
    const take = Math.min(lot.quantity, remaining)
    consumption.push({ lotId: lot.id, quantity: take })
    remaining -= take
  }

  if (remaining > 0) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  return consumption
}
