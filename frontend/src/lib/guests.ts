import type { Project } from '@/api/types'

type GuestDemand = Project['guestDemand']

/** Guests → staff hours. Mirrors backend `domain/guests.py` (same test vectors). */
export function guestHours(guests: number, demand: GuestDemand): number | null {
  const points = [...demand.points].sort((a, b) => a.guests - b.guests)
  if (points.length === 0) return null
  if (guests <= points[0].guests) return points[0].hours
  const last = points[points.length - 1]
  if (guests >= last.guests) return last.hours
  for (let i = 0; i < points.length - 1; i++) {
    const low = points[i]
    const high = points[i + 1]
    if (low.guests <= guests && guests < high.guests) {
      if (demand.mode === 'steps') return low.hours
      const share = (guests - low.guests) / (high.guests - low.guests)
      return low.hours + share * (high.hours - low.hours)
    }
  }
  return last.hours
}
