import { newId } from '@/lib/ids'
import { useUpdateProject } from '@/project/hooks'

import { isWholeSingleDate, type Kind } from './model'

/** Click/drag editing shared by the person calendar and the team overview. */
export function useQuickAdd() {
  const update = useUpdateProject()

  /** Toggle a whole-day entry of `kind` on one date (replacing another kind on that date). */
  const toggleDate = (employeeId: string, date: string, kind: Kind) =>
    update((p) => {
      const same = (e: (typeof p.availability)[number]) =>
        e.employeeId === employeeId && isWholeSingleDate(e, date)
      const existing = p.availability.find((e) => same(e) && e.kind === kind)
      p.availability = p.availability.filter((e) => !same(e))
      if (!existing) {
        p.availability.push({
          id: newId(),
          employeeId,
          kind,
          pattern: { type: 'date', date, start: null, end: null },
          weight: 1,
          note: '',
        })
      }
    })

  /** Add a date range (e.g. vacation); a one-day range toggles that date instead. */
  const addRange = (employeeId: string, from: string, to: string, kind: Kind) => {
    const [startDate, endDate] = from <= to ? [from, to] : [to, from]
    if (startDate === endDate) {
      toggleDate(employeeId, startDate, kind)
      return
    }
    update((p) => {
      p.availability.push({
        id: newId(),
        employeeId,
        kind,
        pattern: { type: 'range', startDate, endDate },
        weight: 1,
        note: '',
      })
    })
  }

  return { toggleDate, addRange }
}
