import { describe, expect, it } from 'vitest'

import { makeProject } from '@/test/fixtures'

import { guestHours } from './guests'

// Same vectors as backend tests/test_guests.py.
const LINEAR: [number, number][] = [
  [900, 20],
  [1000, 20],
  [1100, 22],
  [1250, 25],
  [1400, 28],
  [1500, 30],
  [1600, 30],
]
const STEPS: [number, number][] = [
  [900, 20],
  [1000, 20],
  [1100, 20],
  [1250, 25],
  [1499, 25],
  [1500, 30],
  [1600, 30],
]
const demand = makeProject().guestDemand

describe('guestHours', () => {
  it.each(LINEAR)('linear: %i guests → %i h', (guests, hours) => {
    expect(guestHours(guests, demand)).toBeCloseTo(hours)
  })
  it.each(STEPS)('steps: %i guests → %i h', (guests, hours) => {
    expect(guestHours(guests, { ...demand, mode: 'steps' })).toBeCloseTo(hours)
  })
  it('handles unsorted and empty tables', () => {
    const unsorted = {
      ...demand,
      points: [
        { guests: 2000, hours: 40 },
        { guests: 0, hours: 0 },
      ],
    }
    expect(guestHours(1000, unsorted)).toBeCloseTo(20)
    expect(guestHours(1000, { ...demand, points: [] })).toBeNull()
  })
})
