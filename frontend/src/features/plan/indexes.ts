import type { Shift, Violation } from '@/api/types'

export const cellKey = (employeeId: string, date: string) => `${employeeId}|${date}`

export function shiftsByCell(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>()
  for (const s of shifts) {
    const key = cellKey(s.employeeId, s.date)
    map.set(
      key,
      [...(map.get(key) ?? []), s].sort((a, b) => a.start.localeCompare(b.start)),
    )
  }
  return map
}

export interface ViolationIndex {
  byCell: Map<string, Violation[]>
  byDay: Map<string, Violation[]>
  byEmployee: Map<string, Violation[]>
}

/** Where to show each violation: a person's day, a whole day, or a person's month. */
export function indexViolations(violations: Violation[]): ViolationIndex {
  const index: ViolationIndex = { byCell: new Map(), byDay: new Map(), byEmployee: new Map() }
  const add = (map: Map<string, Violation[]>, key: string, v: Violation) =>
    map.set(key, [...(map.get(key) ?? []), v])
  for (const v of violations) {
    if (v.employeeId && v.date) add(index.byCell, cellKey(v.employeeId, v.date), v)
    else if (v.date) add(index.byDay, v.date, v)
    else if (v.employeeId) add(index.byEmployee, v.employeeId, v)
  }
  return index
}

export function worstSeverity(violations: Violation[] | undefined): 'error' | 'warning' | null {
  if (!violations?.length) return null
  return violations.some((v) => v.severity === 'error') ? 'error' : 'warning'
}

export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function shiftHours(s: Shift): number {
  return (minutes(s.end) - minutes(s.start)) / 60
}
