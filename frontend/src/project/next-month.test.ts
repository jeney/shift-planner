import { describe, expect, it } from 'vitest'

import type { EmployeeStats } from '@/api/types'
import { makeEmployee, makeProject } from '@/test/fixtures'

import { nextMonthProject, weeksIn } from './next-month'

const stat = (employeeId: string, newBalanceHours: number): EmployeeStats => ({
  employeeId,
  shifts: 0,
  plannedHours: 0,
  targetHours: 0,
  deviationHours: 0,
  carryInHours: 0,
  newBalanceHours,
  wishesHonoured: 0,
  wishesTotal: 0,
})

describe('weeksIn', () => {
  it('counts the Mondays in a month', () => {
    expect(weeksIn('2027-02')).toBe(4)
    expect(weeksIn('2027-03')).toBe(5)
    const year = Array.from({ length: 12 }, (_, i) =>
      weeksIn(`2027-${String(i + 1).padStart(2, '0')}`),
    )
    expect(year.reduce((a, b) => a + b)).toBe(52)
  })
})

describe('nextMonthProject', () => {
  const base = makeProject({
    month: '2027-02',
    employees: [
      makeEmployee({
        id: 'a',
        balance: {
          carryInHours: 3.5,
          periodWeek: 14,
          lastShiftEndedAt: null,
          consecutiveDaysAtStart: 2,
        },
      }),
      makeEmployee({ id: 'b' }),
    ],
    availability: [
      {
        id: 'w',
        employeeId: 'a',
        kind: 'unavailable',
        pattern: { type: 'weekly', weekday: 0, start: null, end: null },
        weight: 1,
        note: '',
      },
      {
        id: 'old',
        employeeId: 'a',
        kind: 'wish_off',
        pattern: { type: 'date', date: '2027-02-10', start: null, end: null },
        weight: 1,
        note: '',
      },
      {
        id: 'next',
        employeeId: 'a',
        kind: 'wish_off',
        pattern: { type: 'date', date: '2027-03-02', start: null, end: null },
        weight: 1,
        note: '',
      },
      {
        id: 'span',
        employeeId: 'b',
        kind: 'unavailable',
        pattern: { type: 'range', startDate: '2027-02-25', endDate: '2027-03-03' },
        weight: 1,
        note: '',
      },
    ],
    plan: {
      shifts: [
        {
          id: '1',
          employeeId: 'a',
          date: '2027-02-26',
          start: '06:00',
          end: '14:00',
          pinned: false,
        },
        {
          id: '2',
          employeeId: 'a',
          date: '2027-02-27',
          start: '12:00',
          end: '20:30',
          pinned: false,
        },
        {
          id: '3',
          employeeId: 'a',
          date: '2027-02-28',
          start: '10:00',
          end: '18:00',
          pinned: false,
        },
      ],
    },
  })
  const next = nextMonthProject(base, new Map([['a', stat('a', 1.666)]]))

  it('moves to the following month with a fresh id and no plan', () => {
    expect(next.month).toBe('2027-03')
    expect(next.id).not.toBe(base.id)
    expect(next.plan).toBeNull()
    expect(next.store.name).toBe(base.store.name)
  })

  it('carries the resulting balance and advances the balancing period', () => {
    const a = next.employees[0].balance
    expect(a.carryInHours).toBe(1.67)
    expect(a.periodWeek).toBe(2) // week 14 + 4 weeks in February wraps past 16
    expect(a.lastShiftEndedAt).toBe('2027-02-28T18:00:00')
    expect(a.consecutiveDaysAtStart).toBe(3)
    // Without stats (no plan for that person), the balance is left as it was.
    expect(next.employees[1].balance.carryInHours).toBe(0)
    expect(next.employees[1].balance.periodWeek).toBe(5)
  })

  it('keeps recurring and future availability, drops last month’s', () => {
    expect(next.availability.map((a) => a.id)).toEqual(['w', 'next', 'span'])
  })
})
