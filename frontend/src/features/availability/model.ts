import { Ban, Moon, Sun, type LucideIcon } from 'lucide-react'

import type { AvailabilityEntry, CalendarDay } from '@/api/types'

export type Kind = AvailabilityEntry['kind']
export type Pattern = AvailabilityEntry['pattern']

export const KINDS: Kind[] = ['unavailable', 'wish_off', 'wish_work']

/** Visual language: hard = solid + striped; wishes = dashed outline. Never colour alone. */
export const KIND_STYLE: Record<
  Kind,
  { icon: LucideIcon; hard: boolean; cell: string; chip: string; text: string }
> = {
  unavailable: {
    icon: Ban,
    hard: true,
    cell: 'border-rose-500/70 bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--color-rose-500)_22%,transparent)_0_5px,transparent_5px_10px)] dark:border-rose-400/70',
    chip: 'border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-300',
    text: 'text-rose-700 dark:text-rose-400',
  },
  wish_off: {
    icon: Moon,
    hard: false,
    cell: 'border-dashed border-amber-500/80 bg-amber-500/10 dark:border-amber-400/70',
    chip: 'border-dashed border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-400',
  },
  wish_work: {
    icon: Sun,
    hard: false,
    cell: 'border-dashed border-emerald-500/80 bg-emerald-500/10 dark:border-emerald-400/70',
    chip: 'border-dashed border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
}

export function coversDay(pattern: Pattern, day: CalendarDay): boolean {
  switch (pattern.type) {
    case 'weekly':
      return pattern.weekday === day.weekday
    case 'date':
      return pattern.date === day.date
    case 'range':
      return pattern.startDate <= day.date && day.date <= pattern.endDate
  }
}

/** Time window of an entry, or null when it covers whole days. */
export function windowOf(pattern: Pattern): { start: string | null; end: string | null } | null {
  if (pattern.type === 'range') return null
  if (pattern.start === null && pattern.end === null) return null
  return { start: pattern.start, end: pattern.end }
}

export function entriesOn(
  entries: AvailabilityEntry[],
  employeeId: string,
  day: CalendarDay,
): AvailabilityEntry[] {
  return entries.filter((e) => e.employeeId === employeeId && coversDay(e.pattern, day))
}

/** Most important entry first: hard before wishes, whole day before partial. */
export function strongest(entries: AvailabilityEntry[]): AvailabilityEntry | undefined {
  const rank = (e: AvailabilityEntry) => KINDS.indexOf(e.kind) * 2 + (windowOf(e.pattern) ? 1 : 0)
  return [...entries].sort((a, b) => rank(a) - rank(b))[0]
}

export const isWholeSingleDate = (e: AvailabilityEntry, date: string) =>
  e.pattern.type === 'date' &&
  e.pattern.date === date &&
  e.pattern.start === null &&
  e.pattern.end === null
