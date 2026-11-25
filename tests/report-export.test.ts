import { describe, expect, it } from 'vitest'
import { generateReportCsv, generateReportPdf, type ReportData } from '@/lib/report-format'

const data: ReportData = {
  generatedAt: '2026-11-24T13:00:00.000Z',
  alerts: [
    {
      id: 'a1',
      product: 'Paracetamol 500 mg',
      sku: 'MED-0001',
      branch: 'Sucursal Centro',
      type: 'OUT_OF_STOCK',
      priority: 'CRITICAL',
      stock: 0,
      minimumStock: 50,
      message: 'Producto sin stock',
    },
  ],
  transfers: [
    {
      code: 'TRF-1',
      origin: 'Centro',
      destination: 'Sur',
      status: 'APPROVED',
      createdAt: new Date('2026-11-24T10:00:00Z'),
      items: [
        {
          product: 'Naproxeno',
          sku: 'MED-0002',
          requested: 10,
          approved: 10,
          dispatched: 0,
          received: 0,
        },
      ],
    },
  ],
  replenishments: [
    {
      code: 'REP-1',
      product: 'Salbutamol',
      sku: 'MED-0003',
      branch: 'Norte',
      status: 'APPROVED',
      requested: 20,
      received: 0,
      reason: 'Stock bajo',
      requestedAt: new Date('2026-11-24T09:00:00Z'),
    },
  ],
}

describe('reporte exportable', () => {
  it('genera un CSV con las tres secciones', () => {
    const csv = generateReportCsv(data)

    expect(csv).toContain('## ALERTAS CRITICAS')
    expect(csv).toContain('## TRANSFERENCIAS PENDIENTES')
    expect(csv).toContain('## REPOSICIONES AUTORIZADAS')
    expect(csv).toContain('Paracetamol 500 mg')
    expect(csv).toContain('TRF-1')
    expect(csv).toContain('REP-1')
  })

  it('escapa comillas en el CSV', () => {
    const csv = generateReportCsv({
      ...data,
      alerts: [{ ...data.alerts[0], message: 'dice "hola"' }],
    })

    expect(csv).toContain('dice ""hola""')
  })

  it('genera un PDF válido', async () => {
    const bytes = await generateReportPdf(data)

    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('soporta secciones vacías', async () => {
    const empty: ReportData = {
      generatedAt: data.generatedAt,
      alerts: [],
      transfers: [],
      replenishments: [],
    }

    const csv = generateReportCsv(empty)
    expect(csv).toContain('## ALERTAS CRITICAS')

    const bytes = await generateReportPdf(empty)
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
  })
})
