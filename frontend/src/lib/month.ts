/** Helpers for "YYYY-MM" month strings. */

export function toMonthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parseMonth(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number)
  return { year, month }
}

export function nextMonth(from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  return toMonthString(date.getFullYear(), date.getMonth() + 1)
}

export function formatMonth(value: string, locale: string): string {
  const { year, month } = parseMonth(value)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

export function monthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long' })
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2000, i, 1)))
}
