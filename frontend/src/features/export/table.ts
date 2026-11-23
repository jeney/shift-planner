import type { TFunction } from 'i18next'

import type { CalendarDay, EmployeeStats, Project, Shift } from '@/api/types'
import { formatMonth } from '@/lib/month'
import type { useFormat } from '@/lib/format'

type Format = ReturnType<typeof useFormat>

/** Everything an export shows, already translated. Shared by print, .ods and .xlsx. */
export interface ExportTable {
  title: string
  subtitle: string
  nameHeader: string
  days: { weekday: string; day: number; shaded: boolean; holiday: string | null }[]
  summaryHeaders: string[]
  rows: { name: string; cells: string[]; summary: (number | null)[] }[]
  footer: { label: string; values: number[] }[]
  legend: string[]
}

function minutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function buildExportTable(
  project: Project,
  days: CalendarDay[],
  stats: Map<string, EmployeeStats>,
  t: TFunction,
  format: Format,
): ExportTable {
  const shifts = project.plan?.shifts ?? []
  const byCell = new Map<string, Shift[]>()
  for (const s of shifts) {
    const key = `${s.employeeId}|${s.date}`
    byCell.set(
      key,
      [...(byCell.get(key) ?? []), s].sort((a, b) => a.start.localeCompare(b.start)),
    )
  }
  const employees = project.employees.filter(
    (e) => e.active || shifts.some((s) => s.employeeId === e.id),
  )
  const weekdays = format.weekdays('short')
  const holidays = days.filter((d) => d.holiday)

  return {
    title: `${project.store.name} · ${formatMonth(project.month, format.locale)}`,
    subtitle: t('export.subtitle'),
    nameHeader: t('employees.name'),
    days: days.map((d) => ({
      weekday: weekdays[d.weekday],
      day: Number(d.date.slice(8)),
      shaded: d.weekday >= 5 || d.holiday !== null,
      holiday: d.holiday ? t(`calendar.holidays.${d.holiday}`) : null,
    })),
    summaryHeaders: [
      t('generate.columns.planned'),
      t('generate.columns.target'),
      t('generate.columns.deviation'),
      t('generate.columns.newBalance'),
    ],
    rows: employees.map((e) => {
      const s = stats.get(e.id)
      return {
        name: e.name,
        cells: days.map((d) =>
          (byCell.get(`${e.id}|${d.date}`) ?? []).map((x) => `${x.start}–${x.end}`).join(', '),
        ),
        summary: s
          ? [s.plannedHours, s.targetHours, s.deviationHours, s.newBalanceHours].map(
              (n) => Math.round(n * 10) / 10,
            )
          : [null, null, null, null],
      }
    }),
    footer: [
      {
        label: t('export.peoplePerDay'),
        values: days.map(
          (d) => new Set(shifts.filter((s) => s.date === d.date).map((s) => s.employeeId)).size,
        ),
      },
      {
        label: t('export.hoursPerDay'),
        values: days.map(
          (d) =>
            Math.round(
              shifts
                .filter((s) => s.date === d.date)
                .reduce((sum, s) => sum + minutes(s.end) - minutes(s.start), 0) / 6,
            ) / 10,
        ),
      },
    ],
    legend: [
      t('export.legendTimes'),
      t('export.legendShaded'),
      ...(holidays.length
        ? [
            t('export.legendHolidays', {
              list: holidays
                .map((d) => `${Number(d.date.slice(8))}: ${t(`calendar.holidays.${d.holiday!}`)}`)
                .join(', '),
            }),
          ]
        : []),
      t('export.legendHours'),
    ],
  }
}

export function exportFileName(project: Project, extension: string): string {
  const slug =
    project.store.name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'shift-plan'
  return `${slug}-plan-${project.month}.${extension}`
}
