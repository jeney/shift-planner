import type { TFunction } from 'i18next'

import type { Employee, Violation } from '@/api/types'
import type { useFormat } from '@/lib/format'

type Format = ReturnType<typeof useFormat>

/** A translated, human-readable sentence for a broken rule. */
export function describeViolation(
  v: Violation,
  t: TFunction,
  format: Format,
  employees: Employee[],
): string {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(v.params ?? {})) {
    params[key] = typeof value === 'number' ? format.number(value) : value
  }
  return t(`violation.${v.rule}`, {
    ...params,
    name: employees.find((e) => e.id === v.employeeId)?.name ?? '',
    date: v.date ? format.weekdayDate(v.date) : '',
    start: v.start ?? '',
    end: v.end ?? '',
    missing: v.amount !== null && v.amount !== undefined ? format.number(v.amount) : '',
  })
}
