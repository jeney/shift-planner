import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Parse "YYYY-MM-DD" as a local date (no timezone shift). */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Weekday names, Monday first. */
export function weekdayNames(locale: string, style: 'long' | 'short' = 'long'): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: style })
  // 1 Jan 2024 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 1 + i)))
}

/** Locale-aware formatters bound to the current language. */
export function useFormat() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    const signed = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    })
    const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    const weekdayDate = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    return {
      locale,
      number: (n: number) => number.format(n),
      hours: (n: number) => t('units.hours', { value: number.format(n) }),
      signedHours: (n: number) => t('units.hours', { value: signed.format(n) }),
      dayMonth: (iso: string) => dayMonth.format(parseIsoDate(iso)),
      weekdayDate: (iso: string) => weekdayDate.format(parseIsoDate(iso)),
      weekdays: (style: 'long' | 'short' = 'long') => weekdayNames(locale, style),
    }
  }, [locale, t])
}
