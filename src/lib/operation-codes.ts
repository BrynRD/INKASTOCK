import type { DbClient } from '@/lib/actor'

export type OperationPrefix = 'TRF' | 'REP'

function sequenceFromCode(code: string | null, prefix: OperationPrefix): number {
  if (!code) return 0
  const match = code.match(new RegExp(`^${prefix}-(\\d+)$`))
  return match ? Number(match[1]) : 0
}

export async function nextOperationCode(client: DbClient, prefix: OperationPrefix) {
  const rows =
    prefix === 'TRF'
      ? await client.transfer.findMany({ select: { code: true } })
      : await client.replenishment.findMany({ select: { code: true } })

  const max = rows.reduce((maxSequence, row) => {
    const sequence = sequenceFromCode(row.code, prefix)
    return sequence > maxSequence ? sequence : maxSequence
  }, 0)

  return `${prefix}-${String(max + 1).padStart(5, '0')}`
}
