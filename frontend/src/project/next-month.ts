import type { EmployeeStats, Project } from '@/api/types'
import { newId } from '@/lib/ids'
import { nextMonth, parseMonth } from '@/lib/month'

function daysIn(month: string): string[] {
  const { year, month: m } = parseMonth(month)
  const count = new Date(year, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

/** Weeks to advance the balancing period by: the number of Mondays in the month. */
export function weeksIn(month: string): number {
  return daysIn(month).filter((d) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).getDay() === 1
  }).length
}

/**
 * The same store and team, set up for the following month:
 * - each person's carried-in balance becomes this month's resulting balance, the balancing
 *   period advances (starting a new period after the last week), and their last shift end and
 *   days worked in a row at month end carry over;
 * - recurring weekly availability, and dated entries, special dates and guest counts from the
 *   new month on, are kept; this month's are dropped; the plan starts empty.
 */
export function nextMonthProject(project: Project, stats: Map<string, EmployeeStats>): Project {
  const month = nextMonth(
    new Date(parseMonth(project.month).year, parseMonth(project.month).month - 1, 1),
  )
  const firstOfNext = `${month}-01`
  const weeks = weeksIn(project.month)
  const period = project.rules.balancingPeriodWeeks
  const shifts = project.plan?.shifts ?? []
  const days = daysIn(project.month)

  const employees = project.employees.map((e) => {
    const mine = shifts.filter((s) => s.employeeId === e.id)
    const worked = new Set(mine.map((s) => s.date))
    let streak = 0
    for (let i = days.length - 1; i >= 0 && worked.has(days[i]); i--) streak++
    if (streak === days.length) streak += e.balance.consecutiveDaysAtStart
    const last = [...mine]
      .sort((a, b) => `${a.date}${a.end}`.localeCompare(`${b.date}${b.end}`))
      .at(-1)
    const s = stats.get(e.id)
    return {
      ...e,
      balance: {
        carryInHours: s ? Math.round(s.newBalanceHours * 100) / 100 : e.balance.carryInHours,
        periodWeek: ((e.balance.periodWeek - 1 + weeks) % period) + 1,
        lastShiftEndedAt: last ? `${last.date}T${last.end}:00` : null,
        consecutiveDaysAtStart: streak,
      },
    }
  })

  const keepsDate = (date: string) => date >= firstOfNext
  return {
    ...project,
    id: newId(),
    month,
    employees,
    availability: project.availability.filter((a) => {
      const p = a.pattern
      if (p.type === 'weekly') return true
      if (p.type === 'date') return keepsDate(p.date)
      return keepsDate(p.endDate)
    }),
    store: {
      ...project.store,
      specialDates: project.store.specialDates.filter((d) => keepsDate(d.date)),
    },
    guestDemand: {
      ...project.guestDemand,
      guestsByDate: Object.fromEntries(
        Object.entries(project.guestDemand.guestsByDate).filter(([d]) => keepsDate(d)),
      ),
    },
    plan: null,
  }
}
