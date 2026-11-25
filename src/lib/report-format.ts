import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const INNER_WIDTH = PAGE_WIDTH - MARGIN * 2

export type ReportFormat = 'pdf' | 'csv'

export type ReportAlertRow = {
  id: string
  product: string
  sku: string
  branch: string
  type: string
  priority: string
  stock: number
  minimumStock: number
  message: string
}

export type ReportTransferItem = {
  product: string
  sku: string
  requested: number
  approved: number
  dispatched: number
  received: number
}

export type ReportTransferRow = {
  code: string
  origin: string
  destination: string
  status: string
  createdAt: Date
  items: ReportTransferItem[]
}

export type ReportReplenishmentRow = {
  code: string
  product: string
  sku: string
  branch: string
  status: string
  requested: number
  received: number
  reason: string
  requestedAt: Date
}

export type ReportData = {
  generatedAt: string
  alerts: ReportAlertRow[]
  transfers: ReportTransferRow[]
  replenishments: ReportReplenishmentRow[]
}

type Column = { header: string; width: number; align?: 'left' | 'right' }

function formatDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function csvRow(cells: unknown[]) {
  return cells.map(csvEscape).join(',')
}

export function generateReportCsv(data: ReportData) {
  const lines: string[] = []

  lines.push(csvRow(['InkaStock - Reporte de inventario']))
  lines.push(csvRow([`Generado: ${data.generatedAt}`]))
  lines.push('')

  lines.push('## ALERTAS CRITICAS')
  lines.push(
    csvRow([
      'ID',
      'Producto',
      'SKU',
      'Sucursal',
      'Tipo',
      'Prioridad',
      'Stock',
      'Stock minimo',
      'Mensaje',
    ]),
  )
  for (const alert of data.alerts) {
    lines.push(
      csvRow([
        alert.id,
        alert.product,
        alert.sku,
        alert.branch,
        alert.type,
        alert.priority,
        alert.stock,
        alert.minimumStock,
        alert.message,
      ]),
    )
  }
  lines.push('')

  lines.push('## TRANSFERENCIAS PENDIENTES')
  lines.push(
    csvRow([
      'Codigo',
      'Origen',
      'Destino',
      'Estado',
      'Producto',
      'SKU',
      'Solicitado',
      'Aprobado',
      'Despachado',
      'Recibido',
      'Creado',
    ]),
  )
  for (const transfer of data.transfers) {
    if (transfer.items.length === 0) {
      lines.push(
        csvRow([
          transfer.code,
          transfer.origin,
          transfer.destination,
          transfer.status,
          '',
          '',
          '',
          '',
          '',
          '',
          transfer.createdAt.toISOString(),
        ]),
      )
      continue
    }

    for (const item of transfer.items) {
      lines.push(
        csvRow([
          transfer.code,
          transfer.origin,
          transfer.destination,
          transfer.status,
          item.product,
          item.sku,
          item.requested,
          item.approved,
          item.dispatched,
          item.received,
          transfer.createdAt.toISOString(),
        ]),
      )
    }
  }
  lines.push('')

  lines.push('## REPOSICIONES AUTORIZADAS')
  lines.push(
    csvRow([
      'Codigo',
      'Producto',
      'SKU',
      'Sucursal',
      'Estado',
      'Solicitado',
      'Recibido',
      'Motivo',
      'Solicitado el',
    ]),
  )
  for (const replenishment of data.replenishments) {
    lines.push(
      csvRow([
        replenishment.code,
        replenishment.product,
        replenishment.sku,
        replenishment.branch,
        replenishment.status,
        replenishment.requested,
        replenishment.received,
        replenishment.reason,
        replenishment.requestedAt.toISOString(),
      ]),
    )
  }

  return lines.join('\r\n')
}

function toPdfText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  let value = toPdfText(text)
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value

  const ellipsis = '...'
  while (value.length > 0 && font.widthOfTextAtSize(`${value}${ellipsis}`, size) > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value}${ellipsis}`
}

export async function generateReportPdf(data: ReportData) {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 90,
    width: PAGE_WIDTH,
    height: 90,
    color: rgb(0.06, 0.2, 0.35),
  })
  page.drawText('INKASTOCK', {
    x: MARGIN,
    y: PAGE_HEIGHT - 44,
    font: bold,
    size: 20,
    color: rgb(1, 1, 1),
  })
  page.drawText('Reporte de inventario', {
    x: MARGIN,
    y: PAGE_HEIGHT - 66,
    font: regular,
    size: 11,
    color: rgb(0.78, 0.86, 0.94),
  })
  page.drawText(`Generado: ${formatDate(new Date(data.generatedAt))}`, {
    x: PAGE_WIDTH - MARGIN - 170,
    y: PAGE_HEIGHT - 44,
    font: regular,
    size: 9,
    color: rgb(0.78, 0.86, 0.94),
  })

  y = PAGE_HEIGHT - 120
  page.drawText(
    `Alertas criticas: ${data.alerts.length}    Transferencias: ${data.transfers.length}    Reposiciones: ${data.replenishments.length}`,
    { x: MARGIN, y, font: bold, size: 10, color: rgb(0.06, 0.2, 0.35) },
  )
  y -= 26

  const newPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  const drawSection = (title: string, columns: Column[], rows: string[][]) => {
    if (y - 40 < MARGIN) newPage()

    page.drawRectangle({
      x: MARGIN,
      y: y - 6,
      width: INNER_WIDTH,
      height: 22,
      color: rgb(0.91, 0.94, 0.97),
    })
    page.drawText(toPdfText(title), {
      x: MARGIN + 8,
      y,
      font: bold,
      size: 11,
      color: rgb(0.06, 0.2, 0.35),
    })
    y -= 28

    const drawHeader = () => {
      let x = MARGIN
      for (const column of columns) {
        page.drawText(fitText(column.header, bold, 8, column.width - 6), {
          x: x + 3,
          y,
          font: bold,
          size: 8,
          color: rgb(0.25, 0.3, 0.38),
        })
        x += column.width
      }
      y -= 14
    }

    drawHeader()

    if (rows.length === 0) {
      page.drawText('Sin registros.', {
        x: MARGIN + 3,
        y,
        font: regular,
        size: 9,
        color: rgb(0.5, 0.55, 0.6),
      })
      y -= 22
      return
    }

    for (const row of rows) {
      if (y - 14 < MARGIN) {
        newPage()
        drawHeader()
      }

      let x = MARGIN
      columns.forEach((column, index) => {
        const text = fitText(row[index] ?? '', regular, 8, column.width - 6)
        const drawX =
          column.align === 'right'
            ? x + column.width - 3 - regular.widthOfTextAtSize(text, 8)
            : x + 3
        page.drawText(text, {
          x: drawX,
          y,
          font: regular,
          size: 8,
          color: rgb(0.13, 0.16, 0.22),
        })
        x += column.width
      })
      y -= 14
    }

    y -= 14
  }

  drawSection(
    'Alertas criticas',
    [
      { header: 'Producto', width: 150 },
      { header: 'SKU', width: 70 },
      { header: 'Sucursal', width: 110 },
      { header: 'Tipo', width: 65 },
      { header: 'Prioridad', width: 55 },
      { header: 'Stock', width: 30, align: 'right' },
      { header: 'Min', width: 35, align: 'right' },
    ],
    data.alerts.map((alert) => [
      alert.product,
      alert.sku,
      alert.branch,
      alert.type,
      alert.priority,
      String(alert.stock),
      String(alert.minimumStock),
    ]),
  )

  drawSection(
    'Transferencias pendientes',
    [
      { header: 'Codigo', width: 80 },
      { header: 'Origen', width: 120 },
      { header: 'Destino', width: 120 },
      { header: 'Estado', width: 90 },
      { header: 'Items', width: 40, align: 'right' },
      { header: 'Creado', width: 65 },
    ],
    data.transfers.map((transfer) => [
      transfer.code,
      transfer.origin,
      transfer.destination,
      transfer.status,
      String(transfer.items.length),
      formatDate(transfer.createdAt),
    ]),
  )

  drawSection(
    'Reposiciones autorizadas',
    [
      { header: 'Codigo', width: 80 },
      { header: 'Producto', width: 150 },
      { header: 'Sucursal', width: 120 },
      { header: 'Estado', width: 90 },
      { header: 'Solicitado', width: 40, align: 'right' },
      { header: 'Recibido', width: 35, align: 'right' },
    ],
    data.replenishments.map((replenishment) => [
      replenishment.code,
      replenishment.product,
      replenishment.branch,
      replenishment.status,
      String(replenishment.requested),
      String(replenishment.received),
    ]),
  )

  if (y - 30 < MARGIN) newPage()
  page.drawText(
    'Reporte generado automaticamente por InkaStock. Datos simulados de proyecto academico.',
    { x: MARGIN, y: MARGIN, font: regular, size: 8, color: rgb(0.5, 0.55, 0.6) },
  )

  return document.save()
}

export function buildReportFileName(format: ReportFormat) {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `InkaStock_Report_${datePart}_${timePart}.${format}`
}
