import { zipSync } from 'fflate'

import type { ExportTable } from './table'
import { encoder, escapeXml } from './xml'

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"',
].join(' ')

const BORDER = 'fo:border="0.5pt solid #cccccc"'

const AUTOMATIC_STYLES = `<office:automatic-styles>
<number:number-style style:name="N1"><number:number number:decimal-places="1" number:min-decimal-places="1" number:min-integer-digits="1"/></number:number-style>
<style:style style:name="ta1" style:family="table" style:master-page-name="Landscape"><style:table-properties table:display="true"/></style:style>
<style:style style:name="coName" style:family="table-column"><style:table-column-properties style:column-width="4.5cm"/></style:style>
<style:style style:name="coDay" style:family="table-column"><style:table-column-properties style:column-width="2.3cm"/></style:style>
<style:style style:name="coSum" style:family="table-column"><style:table-column-properties style:column-width="2.2cm"/></style:style>
<style:style style:name="title" style:family="table-cell"><style:text-properties fo:font-size="14pt" fo:font-weight="bold"/></style:style>
<style:style style:name="muted" style:family="table-cell"><style:text-properties fo:font-size="9pt" fo:color="#666666"/></style:style>
<style:style style:name="bold" style:family="table-cell"><style:table-cell-properties ${BORDER}/><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="header" style:family="table-cell"><style:table-cell-properties ${BORDER} style:vertical-align="middle"/><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="headerShaded" style:family="table-cell"><style:table-cell-properties ${BORDER} fo:background-color="#eeeeee" style:vertical-align="middle"/><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="cell" style:family="table-cell"><style:table-cell-properties ${BORDER} fo:wrap-option="wrap" style:vertical-align="middle"/><style:paragraph-properties fo:text-align="center"/></style:style>
<style:style style:name="shaded" style:family="table-cell"><style:table-cell-properties ${BORDER} fo:background-color="#eeeeee" fo:wrap-option="wrap" style:vertical-align="middle"/><style:paragraph-properties fo:text-align="center"/></style:style>
<style:style style:name="number" style:family="table-cell" style:data-style-name="N1"><style:table-cell-properties ${BORDER}/></style:style>
</office:automatic-styles>`

const STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${NS} office:version="1.3">
<office:automatic-styles>
<style:page-layout style:name="pmLandscape"><style:page-layout-properties fo:page-width="29.7cm" fo:page-height="21cm" style:print-orientation="landscape" fo:margin="1cm" style:scale-to-X="1" style:scale-to-Y="0"/></style:page-layout>
</office:automatic-styles>
<office:master-styles><style:master-page style:name="Landscape" style:page-layout-name="pmLandscape"/></office:master-styles>
</office:document-styles>`

type Cell = { value: string | number | null; style: string }

function cell({ value, style }: Cell): string {
  if (value === null || value === '') return `<table:table-cell table:style-name="${style}"/>`
  if (typeof value === 'number') {
    return `<table:table-cell table:style-name="${style}" office:value-type="float" office:value="${value}"><text:p>${value}</text:p></table:table-cell>`
  }
  return `<table:table-cell table:style-name="${style}" office:value-type="string"><text:p>${escapeXml(value)}</text:p></table:table-cell>`
}

const row = (cells: Cell[]) => `<table:table-row>${cells.map(cell).join('')}</table:table-row>`
const emptyRow = '<table:table-row><table:table-cell/></table:table-row>'

/** A minimal, valid OpenDocument spreadsheet (.ods) for LibreOffice. */
export function buildOds(table: ExportTable, sheetName: string): Uint8Array {
  const rows = [
    row([{ value: table.title, style: 'title' }]),
    row([{ value: table.subtitle, style: 'muted' }]),
    emptyRow,
    row([
      { value: table.nameHeader, style: 'bold' },
      ...table.days.map((d) => ({
        value: `${d.weekday} ${d.day}`,
        style: d.shaded ? 'headerShaded' : 'header',
      })),
      ...table.summaryHeaders.map((h) => ({ value: h, style: 'header' })),
    ]),
    ...table.rows.map((line) =>
      row([
        { value: line.name, style: 'bold' },
        ...line.cells.map((c, i) => ({
          value: c,
          style: table.days[i].shaded ? 'shaded' : 'cell',
        })),
        ...line.summary.map((n) => ({ value: n, style: 'number' })),
      ]),
    ),
    ...table.footer.map((f) =>
      row([
        { value: f.label, style: 'bold' },
        ...f.values.map((v, i) => ({ value: v, style: table.days[i].shaded ? 'shaded' : 'cell' })),
      ]),
    ),
    emptyRow,
    ...table.legend.map((line) => row([{ value: line, style: 'muted' }])),
  ]

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.3">
${AUTOMATIC_STYLES}
<office:body><office:spreadsheet>
<table:table table:name="${escapeXml(sheetName)}" table:style-name="ta1">
<table:table-column table:style-name="coName"/>
<table:table-column table:style-name="coDay" table:number-columns-repeated="${table.days.length}"/>
<table:table-column table:style-name="coSum" table:number-columns-repeated="${table.summaryHeaders.length}"/>
${rows.join('\n')}
</table:table>
</office:spreadsheet></office:body>
</office:document-content>`

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`

  // The mimetype entry must come first and be stored uncompressed.
  return zipSync({
    mimetype: [encoder.encode('application/vnd.oasis.opendocument.spreadsheet'), { level: 0 }],
    'META-INF/manifest.xml': encoder.encode(manifest),
    'content.xml': encoder.encode(content),
    'styles.xml': encoder.encode(STYLES),
  })
}
