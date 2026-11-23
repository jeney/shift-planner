import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AvailabilityEntry } from '@/api/types'
import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeCalendar, makeEmployee, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { AvailabilityScreen } from './availability-screen'
import { coversDay, strongest } from './model'

const project = () => useProjectStore.getState().project!
const calendar = makeCalendar('2027-02') // 1 Feb 2027 is a Monday

function entry(partial: Partial<AvailabilityEntry> & Pick<AvailabilityEntry, 'pattern'>) {
  return {
    id: 'x',
    employeeId: 'a',
    kind: 'unavailable',
    weight: 1,
    note: '',
    ...partial,
  } as AvailabilityEntry
}

describe('availability model', () => {
  const monday = calendar.days[0]
  it('matches weekly, date and range patterns', () => {
    expect(coversDay({ type: 'weekly', weekday: 0, start: null, end: null }, monday)).toBe(true)
    expect(coversDay({ type: 'weekly', weekday: 1, start: null, end: null }, monday)).toBe(false)
    expect(coversDay({ type: 'date', date: '2027-02-01', start: null, end: null }, monday)).toBe(
      true,
    )
    expect(
      coversDay({ type: 'range', startDate: '2027-01-30', endDate: '2027-02-01' }, monday),
    ).toBe(true)
  })

  it('ranks hard before wishes and whole days before partial', () => {
    const wish = entry({
      id: 'w',
      kind: 'wish_off',
      pattern: { type: 'date', date: '2027-02-01', start: null, end: null },
    })
    const partial = entry({
      id: 'p',
      pattern: { type: 'weekly', weekday: 0, start: '16:00', end: null },
    })
    const whole = entry({
      id: 'h',
      pattern: { type: 'date', date: '2027-02-01', start: null, end: null },
    })
    expect(strongest([wish, partial])?.id).toBe('p')
    expect(strongest([wish, partial, whole])?.id).toBe('h')
  })
})

describe('AvailabilityScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    mockApi({
      'GET /api/health': healthOk,
      'GET /api/calendar/2027-02': () => Response.json(calendar),
    })
    useProjectStore.setState({
      project: makeProject({
        employees: [makeEmployee({ id: 'a', name: 'Anna' }), makeEmployee({ id: 'b', name: 'Bo' })],
      }),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  const day = (label: RegExp) => screen.findByRole('gridcell', { name: label })

  it('toggles a whole day with the keyboard and replaces it when the mode changes', async () => {
    renderWithProviders(<AvailabilityScreen />)
    const cell = await day(/^Fri, Feb 5/)
    cell.focus()
    await userEvent.keyboard('{Enter}')
    expect(project().availability).toMatchObject([
      { employeeId: 'a', kind: 'unavailable', pattern: { type: 'date', date: '2027-02-05' } },
    ])

    await userEvent.click(screen.getByRole('radio', { name: /Wants to work/ }))
    ;(await day(/^Fri, Feb 5/)).focus()
    await userEvent.keyboard('{Enter}')
    expect(project().availability).toMatchObject([{ kind: 'wish_work' }])

    ;(await day(/^Fri, Feb 5/)).focus()
    await userEvent.keyboard('{Enter}')
    expect(project().availability).toEqual([])
  })

  it('creates a range by dragging across days', async () => {
    renderWithProviders(<AvailabilityScreen />)
    fireEvent.pointerDown(await day(/^Wed, Feb 10/), { button: 0 })
    fireEvent.pointerEnter(await day(/^Fri, Feb 12/))
    fireEvent.pointerUp(window)
    expect(project().availability).toMatchObject([
      {
        employeeId: 'a',
        kind: 'unavailable',
        pattern: { type: 'range', startDate: '2027-02-10', endDate: '2027-02-12' },
      },
    ])
    expect(await day(/^Thu, Feb 11.*Unavailable: Feb 10 – Feb 12/)).toBeInTheDocument()
  })

  it('adds a recurring part-day rule from the dialog', async () => {
    renderWithProviders(<AvailabilityScreen />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Only part of the day' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(project().availability).toMatchObject([
      { kind: 'unavailable', pattern: { type: 'weekly', weekday: 0, start: '16:00', end: null } },
    ])
    expect(screen.getByText(/^every Monday, from 16:00$/)).toBeInTheDocument()
  })

  it('sets how important a wish is', async () => {
    useProjectStore.getState().updateProject((p) => {
      p.availability.push(
        entry({
          id: 'w',
          kind: 'wish_off',
          pattern: { type: 'weekly', weekday: 6, start: null, end: null },
        }),
      )
    })
    renderWithProviders(<AvailabilityScreen />)
    const list = await screen.findByRole('list', { name: 'Availability and wishes' })
    await userEvent.click(within(list).getByRole('radio', { name: 'Important' }))
    expect(project().availability[0].weight).toBe(2)
  })

  it('edits other people from the team view', async () => {
    renderWithProviders(<AvailabilityScreen />)
    await userEvent.click(screen.getByRole('radio', { name: /Team/ }))
    const table = await screen.findByRole('table', { name: 'Team availability' })
    const cell = await within(table).findByRole('button', { name: 'Bo, Mon, Feb 1' })
    cell.focus()
    await userEvent.keyboard('{Enter}')
    expect(project().availability).toMatchObject([
      { employeeId: 'b', pattern: { date: '2027-02-01' } },
    ])
  })
})
