import type { TFunction } from 'i18next'

import type { Diagnostic, Employee } from '@/api/types'
import type { useFormat } from '@/lib/format'

type Format = ReturnType<typeof useFormat>

const KNOWN = new Set([
  'no_employees',
  'opening_short',
  'closing_short',
  'moment_short',
  'busy_period_short',
  'day_short_of_people',
  'window_shorter_than_min_shift',
  'not_enough_working_days',
  'hours_below_demand',
  'hours_above_demand',
  'rider_without_driver',
  'no_driver_early',
  'solver.timeout',
])
const LISTS_UNAVAILABLE = new Set([
  'opening_short',
  'closing_short',
  'moment_short',
  'busy_period_short',
  'day_short_of_people',
])

/** A translated sentence for a pre-check finding. */
export function describeDiagnostic(
  d: Diagnostic,
  t: TFunction,
  format: Format,
  employees: Employee[],
): string {
  const names = (d.employeeIds ?? [])
    .map((id) => employees.find((e) => e.id === id)?.name ?? '')
    .filter(Boolean)
    .join(', ')
  const params: Record<string, string | number> = { names }
  for (const [key, value] of Object.entries(d.params ?? {})) {
    params[key] = typeof value === 'number' ? format.number(value) : value
  }
  if (d.date) params.date = format.weekdayDate(d.date)
  // Codes are open-ended on the wire; unknown ones fall back to a generic sentence.
  const key = (
    KNOWN.has(d.code) ? `diagnostic.${d.code}` : 'diagnostic.unknown'
  ) as 'diagnostic.unknown'
  const message = t(key, params)
  return LISTS_UNAVAILABLE.has(d.code) && names
    ? `${message} ${t('diagnostic.unavailableList', { names })}`
    : message
}
