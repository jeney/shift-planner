import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Shift, ValidateResponse } from '@/api/types'
import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeCalendar, makeEmployee, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { useHistory } from './history'
import { PlanScreen } from './plan-screen'

const project = () => useProjectStore.getState().project!
const shift = (over: Partial<Shift> = {}): Shift => ({
  id: 's1',
  employeeId: 'a',
  date: '2027-02-01',
  start: '06:00',
  end: '14:00',
  pinned: false,
  ...over,
})
const empty: ValidateResponse = { violations: [], stats: [], wishes: [] }

function setup(shifts: Shift[], validate: () => ValidateResponse = () => empty) {
  useProjectStore.setState({
    project: makeProject({
      employees: [makeEmployee({ id: 'a', name: 'Anna' }), makeEmployee({ id: 'b', name: 'Bo' })],
      plan: { shifts },
    }),
  })
  return mockApi({
    'GET /api/health': healthOk,
    'GET /api/calendar/2027-02': () => Response.json(makeCalendar('2027-02')),
    'POST /api/validate': () => Response.json(validate()),
    'POST /api/solve': () =>
      Response.json({
        status: 'optimal',
        plan: { shifts: [shift({ id: 'new', employeeId: 'b' })] },
        violations: [],
        diagnostics: [],
        stats: [],
        wishes: [],
        solveTimeMs: 10,
      }),
  })
}

const cell = (name: RegExp) => screen.findByRole('gridcell', { name })

describe('PlanScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useHistory.setState({ projectId: null, past: [], future: [] })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('offers to plan by hand when there is no plan', async () => {
    setup([])
    useProjectStore.getState().updateProject((p) => {
      p.plan = null
    })
    renderWithProviders(<PlanScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Plan by hand' }))
    expect(project().plan).toEqual({ shifts: [] })
  })

  it('shows shifts in the grid', async () => {
    setup([shift()])
    renderWithProviders(<PlanScreen />)
    const c = await cell(/^Anna, Mon, Feb 1\. 06:00–14:00/)
    expect(c).toHaveTextContent('06:00–14:00')
  })

  it('adds a shift by hand, pinned, with undo and redo', async () => {
    setup([])
    renderWithProviders(<PlanScreen />)
    await userEvent.click(await cell(/^Bo, Tue, Feb 2\. no shift/))
    const start = await screen.findByLabelText('Start')
    fireEvent.change(start, { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '16:30' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add shift' }))

    expect(project().plan!.shifts).toMatchObject([
      { employeeId: 'b', date: '2027-02-02', start: '10:00', end: '16:30', pinned: true },
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(project().plan!.shifts).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(project().plan!.shifts).toHaveLength(1)
  })

  it('pins an edited generated shift, and can unpin all', async () => {
    setup([shift()])
    renderWithProviders(<PlanScreen />)
    await userEvent.click(await cell(/^Anna, Mon, Feb 1\./))
    fireEvent.change(await screen.findByLabelText('End'), { target: { value: '13:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(project().plan!.shifts[0]).toMatchObject({ end: '13:00', pinned: true })

    await userEvent.click(screen.getByRole('button', { name: 'Unpin all' }))
    expect(project().plan!.shifts[0].pinned).toBe(false)
  })

  it('clears a shift with the Delete key and moves with the arrow keys', async () => {
    setup([shift()])
    renderWithProviders(<PlanScreen />)
    const c = await cell(/^Anna, Mon, Feb 1\./)
    c.focus()
    await userEvent.keyboard('{Delete}')
    expect(project().plan!.shifts).toEqual([])
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAccessibleName(/^Anna, Tue, Feb 2\./)
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName(/^Bo, Tue, Feb 2\./)
  })

  it('highlights broken rules from live validation', async () => {
    setup([shift({ start: '06:00', end: '16:00' })], () => ({
      ...empty,
      violations: [
        {
          rule: 'shift_too_long',
          severity: 'error',
          employeeId: 'a',
          date: '2027-02-01',
          start: '06:00',
          end: '16:00',
          amount: 2,
          params: { max: 8 },
        },
      ],
    }))
    renderWithProviders(<PlanScreen />)
    await waitFor(async () =>
      expect(await cell(/^Anna, Mon, Feb 1\./)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(await cell(/^Anna, Mon, Feb 1\./)).toHaveAccessibleName(
      /Anna's shift on Mon, Feb 1 is longer than 8 h\./,
    )
    expect(screen.getByRole('list', { name: 'Broken rules and warnings' })).toHaveTextContent(
      "Anna's shift on Mon, Feb 1 is longer than 8 h.",
    )
    expect(screen.getByRole('status')).toHaveTextContent('1 rule broken')
  })

  it('re-generates keeping only pinned shifts', async () => {
    const fetchMock = setup([
      shift({ id: 'kept', pinned: true }),
      shift({ id: 'free', date: '2027-02-02' }),
    ])
    renderWithProviders(<PlanScreen />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Re-generate, keeping 1 edit' }),
    )
    await waitFor(() => expect(project().plan!.shifts.map((s) => s.id)).toEqual(['new']))
    const call = fetchMock.mock.calls.find(([r]) => (r as Request).url.endsWith('/api/solve'))
    const body = await (call![0] as Request).json()
    expect(body.plan.shifts.map((s: Shift) => s.id)).toEqual(['kept'])
    // Undo brings the previous plan back.
    act(() => {
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    })
    expect(project().plan!.shifts.map((s) => s.id)).toEqual(['kept', 'free'])
    expect(within(screen.getByRole('grid')).getAllByRole('gridcell').length).toBe(2 * 28)
  })
})
