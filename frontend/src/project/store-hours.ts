import type { CalendarDay, StoreSettings } from '@/api/types'
import { minutesToTime, timeToMinutes } from '@/lib/format'

export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

export const DAY_TYPES = ['weekday', 'saturday', 'sunday', 'holiday'] as const

type DayHours = StoreSettings['publicHolidayHours']

/** Regular hours for a day, ignoring special dates (mirrors the backend). */
export function regularHours(store: StoreSettings, day: CalendarDay): DayHours {
  if (day.holiday) return store.publicHolidayHours
  return store.openingHours[WEEKDAY_KEYS[day.weekday]]
}

/** Hours that apply on a day: an enabled special date wins (mirrors the backend). */
export function effectiveHours(store: StoreSettings, day: CalendarDay): DayHours {
  const special = store.specialDates.find((s) => s.date === day.date && s.enabled)
  if (special) return { closed: special.closed, opens: special.opens, closes: special.closes }
  return regularHours(store, day)
}

/** When staff are present: opening hours widened by the before/after minutes. */
export function staffedRange(store: StoreSettings, hours: DayHours) {
  return {
    start: minutesToTime(timeToMinutes(hours.opens) - store.staffBeforeOpeningMin),
    end: minutesToTime(timeToMinutes(hours.closes) + store.staffAfterClosingMin),
  }
}

export function isValidWindow(start: string, end: string): boolean {
  return timeToMinutes(start) < timeToMinutes(end)
}
