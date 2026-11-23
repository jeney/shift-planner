import { useMonthCalendar } from '@/api/queries'
import { monthFactor, teamTargets } from '@/lib/targets'
import { useProject } from '@/project/hooks'

/** Monthly targets for the current project (empty until the calendar has loaded). */
export function useTargets() {
  const project = useProject()
  const calendar = useMonthCalendar(project.month).data
  return {
    calendar,
    targets: calendar ? teamTargets(project, calendar) : new Map<string, number>(),
    factor: calendar ? monthFactor(project.rules, calendar) : null,
    weekdays: calendar ? calendar.days.filter((d) => d.weekday < 5).length : null,
  }
}
