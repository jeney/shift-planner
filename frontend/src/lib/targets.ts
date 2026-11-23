import type { Employee, MonthCalendar, Project, Rules } from '@/api/types'

/** Mirrors backend `domain/hours.py`. The test vectors in targets.test.ts match the backend's. */

export const WEEKS_PER_MONTH = 52 / 12

export function monthFactor(rules: Rules, calendar: MonthCalendar): number {
  switch (rules.monthlyTargetMode) {
    case 'weeks_per_month':
      return WEEKS_PER_MONTH
    case 'fixed_4_4':
      return 4.4
    case 'actual_weekdays':
      return calendar.days.filter((d) => d.weekday < 5).length / 5
  }
}

export function weekdayHolidays(calendar: MonthCalendar): number {
  return calendar.days.filter((d) => d.holiday && d.weekday < 5).length
}

export function monthlyTarget(employee: Employee, rules: Rules, calendar: MonthCalendar): number {
  if (!employee.active) return 0
  const weekly = employee.contractHoursPerWeek
  let target = weekly * monthFactor(rules, calendar)
  if (rules.holidaysReduceTarget) target -= (weekly / 5) * weekdayHolidays(calendar)
  return Math.max(0, target)
}

/** Monthly targets with the team adjustment spread in proportion to contract hours. */
export function teamTargets(project: Project, calendar: MonthCalendar): Map<string, number> {
  const base = new Map(
    project.employees.map((e) => [e.id, monthlyTarget(e, project.rules, calendar)]),
  )
  const total = [...base.values()].reduce((a, b) => a + b, 0)
  const adjustment = project.rules.teamAdjustmentHours
  if (total <= 0 || adjustment === 0) return base
  return new Map(
    [...base].map(([id, hours]) => [id, Math.max(0, hours + (adjustment * hours) / total)]),
  )
}
