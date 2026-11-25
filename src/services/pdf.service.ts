import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type PdfSection = {
  title: string
  lines: Array<[string, string]>
}

export type PdfInput = {
  title: string
  subtitle: string
  code: string
  sections: PdfSection[]
  note?: string
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean)
  let line = ''
  let currentY = y

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    page.drawText(line, { x, y: currentY, font, size, color: rgb(0.13, 0.16, 0.22) })
    currentY -= lineHeight
    line = word
  }

  if (line) {
    page.drawText(line, { x, y: currentY, font, size, color: rgb(0.13, 0.16, 0.22) })
    currentY -= lineHeight
  }

  return currentY
}

export async function buildOperationPdf(input: PdfInput) {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 96,
    width: PAGE_WIDTH,
    height: 96,
    color: rgb(0.06, 0.2, 0.35),
  })
  page.drawText('INKASTOCK', {
    x: MARGIN,
    y: PAGE_HEIGHT - 48,
    font: bold,
    size: 20,
    color: rgb(1, 1, 1),
  })
  page.drawText('Expediente de operación', {
    x: MARGIN,
    y: PAGE_HEIGHT - 70,
    font: regular,
    size: 10,
    color: rgb(0.78, 0.86, 0.94),
  })
  page.drawText(input.code, {
    x: PAGE_WIDTH - MARGIN - 150,
    y: PAGE_HEIGHT - 52,
    font: bold,
    size: 14,
    color: rgb(1, 1, 1),
  })

  y = PAGE_HEIGHT - 130
  page.drawText(input.title, { x: MARGIN, y, font: bold, size: 17, color: rgb(0.06, 0.2, 0.35) })
  y -= 22
  page.drawText(input.subtitle, { x: MARGIN, y, font: regular, size: 10, color: rgb(0.34, 0.4, 0.48) })
  y -= 28

  for (const section of input.sections) {
    if (y < 150) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - 8,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 24,
      color: rgb(0.91, 0.94, 0.97),
    })
    page.drawText(section.title, {
      x: MARGIN + 8,
      y: y,
      font: bold,
      size: 11,
      color: rgb(0.06, 0.2, 0.35),
    })
    y -= 28

    for (const [label, value] of section.lines) {
      if (y < 90) {
        page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        y = PAGE_HEIGHT - MARGIN
      }
      page.drawText(label, { x: MARGIN + 4, y, font: bold, size: 9, color: rgb(0.25, 0.3, 0.38) })
      y = drawWrappedText(page, value, MARGIN + 170, y, PAGE_WIDTH - MARGIN * 2 - 180, regular, 9, 13) - 4
    }
    y -= 12
  }

  const note = input.note ?? 'Datos simulados — proyecto académico. No representan existencias reales de Inkafarma.'
  if (y < 90) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }
  page.drawText(note, { x: MARGIN, y, font: regular, size: 8, color: rgb(0.5, 0.55, 0.6) })

  return document.save()
}
