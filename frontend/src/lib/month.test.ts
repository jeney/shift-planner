import { describe, expect, it } from 'vitest'

import { formatMonth, monthNames, nextMonth, parseMonth, toMonthString } from './month'

describe('month helpers', () => {
  it('formats and parses YYYY-MM', () => {
    expect(toMonthString(2027, 3)).toBe('2027-03')
    expect(parseMonth('2027-11')).toEqual({ year: 2027, month: 11 })
  })

  it('computes next month across a year boundary', () => {
    expect(nextMonth(new Date(2026, 11, 15))).toBe('2027-01')
    expect(nextMonth(new Date(2027, 0, 31))).toBe('2027-02')
  })

  it('formats per locale', () => {
    expect(formatMonth('2027-02', 'en')).toBe('February 2027')
    expect(formatMonth('2027-02', 'da')).toMatch(/februar 2027/)
    expect(formatMonth('2027-02', 'hu')).toMatch(/2027\. február/)
    expect(monthNames('en')).toHaveLength(12)
  })
})
