import type { TFunction } from 'i18next'

import type { AvailabilityEntry } from '@/api/types'
import type { useFormat } from '@/lib/format'

import { windowOf } from './model'

type Format = ReturnType<typeof useFormat>

function describeWindow(entry: AvailabilityEntry, t: TFunction): string {
  const window = windowOf(entry.pattern)
  if (!window) return t('availability.describe.allDay')
  if (window.start && window.end) return `${window.start}–${window.end}`
  if (window.start) return t('availability.describe.from', { time: window.start })
  return t('availability.describe.until', { time: window.end })
}

/** E.g. "Every Monday, from 16:00" / "Fri 5 Feb, all day" / "10 Feb – 16 Feb". */
export function describeEntry(entry: AvailabilityEntry, t: TFunction, format: Format): string {
  const pattern = entry.pattern
  switch (pattern.type) {
    case 'weekly':
      return t('availability.describe.weekly', {
        weekday: format.weekdays('long')[pattern.weekday],
        window: describeWindow(entry, t),
      })
    case 'date':
      return `${format.weekdayDate(pattern.date)}, ${describeWindow(entry, t)}`
    case 'range':
      return `${format.dayMonth(pattern.startDate)} – ${format.dayMonth(pattern.endDate)}`
  }
}
