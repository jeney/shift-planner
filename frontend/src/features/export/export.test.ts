/// <reference types="node" />
// Node APIs are only used to write sample files for manual checks (EXPORT_SAMPLES_DIR).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { strFromU8, unzipSync } from 'fflate'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { makeCalendar, makeEmployee, makeProject } from '@/test/fixtures'

import { buildOds } from './ods'
import { buildExportTable, exportFileName, type ExportTable } from './table'
import { buildXlsx } from './xlsx'

const format = {
  locale: 'en',
  number: (n: number) => String(n),
  hours: (n: number) => `${n} h`,
  signedHours: (n: number) => `${n} h`,
  dayMonth: (d: string) => d,
  weekdayDate: (d: string) => d,
  weekdays: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

function sample(): ExportTable {
  const project = makeProject({
    month: '2027-03',
    store: { ...makeProject().store, name: 'Café Ø & Co' },
    employees: [
      makeEmployee({ id: 'a', name: 'Anna <Holm>' }),
      makeEmployee({ id: 'b', name: 'Örs Bőrős' }),
    ],
    plan: {
      shifts: [
        {
          id: '1',
          employeeId: 'a',
          date: '2027-03-01',
          start: '06:00',
          end: '14:00',
          pinned: false,
        },
        {
          id: '2',
          employeeId: 'b',
          date: '2027-03-01',
          start: '12:00',
          end: '20:30',
          pinned: true,
        },
        {
          id: '3',
          employeeId: 'a',
          date: '2027-03-29',
          start: '07:00',
          end: '11:00',
          pinned: false,
        },
        {
          id: '4',
          employeeId: 'a',
          date: '2027-03-29',
          start: '13:00',
          end: '18:00',
          pinned: false,
        },
      ],
    },
  })
  const calendar = makeCalendar('2027-03', { holidays: { '2027-03-29': 'easter_monday' } })
  const stats = new Map([
    [
      'a',
      {
        employeeId: 'a',
        shifts: 3,
        plannedHours: 17,
        targetHours: 86.67,
        deviationHours: -69.67,
        carryInHours: 0,
        newBalanceHours: -69.67,
        wishesHonoured: 0,
        wishesTotal: 0,
      },
    ],
  ])
  return buildExportTable(project, calendar.days, stats, i18n.t, format as never)
}

describe('export table', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('lays out people × days with summaries, totals and a legend', () => {
    const table = sample()
    expect(table.title).toBe('Café Ø & Co · March 2027')
    expect(table.days).toHaveLength(31)
    expect(table.days[0]).toEqual({ weekday: 'Mon', day: 1, shaded: false, holiday: null })
    expect(table.days[5].shaded).toBe(true) // Saturday 6 March
    expect(table.days[28]).toMatchObject({ shaded: true, holiday: 'Easter Monday' })
    expect(table.rows.map((r) => r.name)).toEqual(['Anna <Holm>', 'Örs Bőrős'])
    expect(table.rows[0].cells[0]).toBe('06:00–14:00')
    expect(table.rows[0].cells[28]).toBe('07:00–11:00, 13:00–18:00')
    expect(table.rows[0].summary).toEqual([17, 86.7, -69.7, -69.7])
    expect(table.rows[1].summary).toEqual([null, null, null, null])
    expect(table.footer[0].values[0]).toBe(2)
    expect(table.footer[1].values[0]).toBe(16.5)
    expect(table.legend.join(' ')).toContain('Public holidays: 29: Easter Monday.')
  })

  it('names files after the store and month', () => {
    expect(exportFileName(makeProject({ month: '2027-03' }), 'ods')).toBe(
      'test-store-plan-2027-03.ods',
    )
  })
})

describe('spreadsheet files', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('writes a valid .xlsx package', () => {
    const files = unzipSync(buildXlsx(sample(), 'Plan'))
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('<t xml:space="preserve">Anna &lt;Holm&gt;</t>')
    expect(sheet).toContain('Örs Bőrős')
    expect(sheet).toContain('<v>-69.7</v>')
    expect(sheet).toContain('<pane xSplit="1" ySplit="4" topLeftCell="B5"')
    for (const xml of Object.values(files)) {
      expect(
        new DOMParser()
          .parseFromString(strFromU8(xml), 'application/xml')
          .querySelector('parsererror'),
      ).toBeNull()
    }
  })

  it('writes a valid .ods package with an uncompressed mimetype first', () => {
    const bytes = buildOds(sample(), 'Plan')
    // Local file header of the first entry: name "mimetype", compression method 0 (stored).
    const view = new DataView(bytes.buffer, bytes.byteOffset)
    expect(view.getUint16(8, true)).toBe(0)
    expect(strFromU8(bytes.slice(30, 38))).toBe('mimetype')
    const files = unzipSync(bytes)
    expect(strFromU8(files.mimetype)).toBe('application/vnd.oasis.opendocument.spreadsheet')
    const content = strFromU8(files['content.xml'])
    expect(content).toContain('<text:p>Anna &lt;Holm&gt;</text:p>')
    expect(content).toContain('office:value-type="float" office:value="-69.7"')
    expect(content).toContain('table:number-columns-repeated="31"')
    for (const xml of ['content.xml', 'styles.xml', 'META-INF/manifest.xml']) {
      expect(
        new DOMParser()
          .parseFromString(strFromU8(files[xml]), 'application/xml')
          .querySelector('parsererror'),
      ).toBeNull()
    }
  })

  it.runIf(process.env.EXPORT_SAMPLES_DIR)('writes sample files for manual checks', () => {
    const dir = process.env.EXPORT_SAMPLES_DIR!
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'sample.xlsx'), buildXlsx(sample(), 'Plan'))
    writeFileSync(join(dir, 'sample.ods'), buildOds(sample(), 'Plan'))
  })
})
