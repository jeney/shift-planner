import { zipSync } from 'fflate'

import type { ExportTable } from './table'
import { encoder, escapeXml } from './xml'

/** Style indexes in styles.xml (cellXfs). */
const S = { text: 0, title: 1, header: 2, headerShaded: 3, shaded: 4, number: 5, bold: 6, muted: 7 }

function column(index: number): string {
  let name = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

type Cell = string | number | null | { value: string | number | null; style: number }

function row(r: number, cells: Cell[]): string {
  const xml = cells
    .map((cell, c) => {
      const { value, style } =
        cell !== null && typeof cell === 'object' ? cell : { value: cell, style: S.text }
      const ref = `${column(c)}${r}`
      if (value === null || value === '') return style ? `<c r="${ref}" s="${style}"/>` : ''
      if (typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    })
    .join('')
  return `<row r="${r}">${xml}</row>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>
<fonts count="4">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="14"/><name val="Arial"/></font>
<font><b/><sz val="10"/><name val="Arial"/></font>
<font><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEEEEE"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFCCCCCC"/></left><right style="thin"><color rgb="FFCCCCCC"/></right><top style="thin"><color rgb="FFCCCCCC"/></top><bottom style="thin"><color rgb="FFCCCCCC"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`

/** A minimal, valid SpreadsheetML (.xlsx) workbook with one sheet. */
export function buildXlsx(table: ExportTable, sheetName: string): Uint8Array {
  const dayCount = table.days.length
  const rows: string[] = []
  let r = 1
  rows.push(row(r++, [{ value: table.title, style: S.title }]))
  rows.push(row(r++, [{ value: table.subtitle, style: S.muted }]))
  r++
  const headerRow = r
  rows.push(
    row(r++, [
      { value: table.nameHeader, style: S.bold },
      ...table.days.map((d) => ({
        value: `${d.weekday} ${d.day}`,
        style: d.shaded ? S.headerShaded : S.header,
      })),
      ...table.summaryHeaders.map((h) => ({ value: h, style: S.header })),
    ]),
  )
  for (const line of table.rows) {
    rows.push(
      row(r++, [
        { value: line.name, style: S.bold },
        ...line.cells.map((c, i) => ({
          value: c,
          style: table.days[i].shaded ? S.shaded : S.text,
        })),
        ...line.summary.map((n) => ({ value: n, style: S.number })),
      ]),
    )
  }
  for (const f of table.footer) {
    rows.push(
      row(r++, [
        { value: f.label, style: S.bold },
        ...f.values.map((v, i) => ({ value: v, style: table.days[i].shaded ? S.shaded : S.text })),
      ]),
    )
  }
  r++
  for (const line of table.legend) rows.push(row(r++, [{ value: line, style: S.muted }]))

  const cols =
    `<col min="1" max="1" width="22" customWidth="1"/>` +
    `<col min="2" max="${dayCount + 1}" width="12" customWidth="1"/>` +
    `<col min="${dayCount + 2}" max="${dayCount + 5}" width="11" customWidth="1"/>`
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="${headerRow}" topLeftCell="B${headerRow + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${rows.join('')}</sheetData>
<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`

  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': sheet,
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, encoder.encode(v)])))
}
