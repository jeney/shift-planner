import { describe, expect, it } from 'vitest'

import { makeCalendar, makeEmployee, makeProject } from '@/test/fixtures'

import { monthlyTarget, teamTargets } from './targets'

// Same vectors as backend tests/test_hours.py::TestMonthlyTarget.
const feb2027 = makeCalendar('2027-02')
const mar2027 = makeCalendar('2027-03', {
  holidays: {
    '2027-03-25': 'maundy_thursday',
    '2027-03-26': 'good_friday',
    '2027-03-28': 'easter_sunday',
    '2027-03-29': 'easter_monday',
  },
})
const rules = makeProject().rules
const ten = makeEmployee({ contractHoursPerWeek: 10 })

describe('monthlyTarget', () => {
  it('defaults to 52/12 weeks per month', () => {
    expect(monthlyTarget(ten, rules, feb2027)).toBeCloseTo(43.333, 3)
  })

  it('supports a fixed 4.4 factor', () => {
    expect(monthlyTarget(ten, { ...rules, monthlyTargetMode: 'fixed_4_4' }, feb2027)).toBeCloseTo(
      44,
    )
  })

  it('supports actual weekdays', () => {
    const actual = { ...rules, monthlyTargetMode: 'actual_weekdays' as const }
    expect(monthlyTarget(ten, actual, feb2027)).toBeCloseTo(40)
    expect(monthlyTarget(ten, actual, mar2027)).toBeCloseTo(46)
    expect(monthlyTarget(ten, { ...actual, holidaysReduceTarget: true }, mar2027)).toBeCloseTo(40)
  })

  it('is zero for inactive employees', () => {
    expect(monthlyTarget({ ...ten, active: false }, rules, feb2027)).toBe(0)
  })

  it('spreads the team adjustment by contract hours', () => {
    const project = makeProject({
      employees: [
        makeEmployee({ id: 'a', contractHoursPerWeek: 40 }),
        makeEmployee({ id: 'b', contractHoursPerWeek: 10 }),
      ],
      rules: { ...rules, monthlyTargetMode: 'fixed_4_4', teamAdjustmentHours: -10 },
    })
    const targets = teamTargets(project, feb2027)
    expect(targets.get('a')).toBeCloseTo(168)
    expect(targets.get('b')).toBeCloseTo(42)
  })
})
