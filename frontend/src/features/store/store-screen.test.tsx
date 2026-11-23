import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeCalendar, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { StoreScreen } from './store-screen'

const project = () => useProjectStore.getState().project!

describe('StoreScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useProjectStore.setState({ project: makeProject({ month: '2027-12' }) })
    mockApi({
      'GET /api/health': healthOk,
      'GET /api/calendar/2027-12': () =>
        Response.json(
          makeCalendar('2027-12', {
            holidays: { '2027-12-25': 'christmas_day', '2027-12-26': 'boxing_day' },
            notable: { '2027-12-24': 'christmas_eve', '2027-12-31': 'new_years_eve' },
          }),
        ),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows default opening hours and the staffed range', () => {
    renderWithProviders(<StoreScreen />)
    expect(screen.getByLabelText('Monday: opens')).toHaveValue('07:00')
    expect(screen.getByLabelText('Monday: closes')).toHaveValue('20:00')
    expect(screen.getByLabelText('Tuesday: closes')).toHaveValue('18:00')
    expect(screen.getAllByText('Staff 06:00–20:30')).toHaveLength(2) // Monday and Friday
  })

  it('edits opening hours and flags an invalid range', () => {
    renderWithProviders(<StoreScreen />)
    fireEvent.change(screen.getByLabelText('Tuesday: closes'), { target: { value: '19:00' } })
    expect(project().store.openingHours.tuesday.closes).toBe('19:00')

    fireEvent.change(screen.getByLabelText('Tuesday: closes'), { target: { value: '06:00' } })
    expect(screen.getByText('Closing time must be after opening time.')).toBeInTheDocument()
  })

  it('can close the store on a weekday', async () => {
    renderWithProviders(<StoreScreen />)
    await userEvent.click(screen.getByRole('switch', { name: 'Open on Sunday' }))
    expect(project().store.openingHours.sunday.closed).toBe(true)
  })

  it('lists holidays and notable days, defaulting special hours to closing an hour early', async () => {
    renderWithProviders(<StoreScreen />)
    const item = (await screen.findByText('Christmas Eve')).closest('li')!
    expect(within(item).getByText('Notable day')).toBeInTheDocument()
    expect(screen.getByText('Christmas Day')).toBeInTheDocument()
    expect(project().store.specialDates).toEqual([])

    await userEvent.click(within(item).getByRole('switch', { name: 'Special hours' }))
    // 24 Dec 2027 is a Friday: 07:00–20:00 normally, so 07:00–19:00.
    expect(project().store.specialDates).toEqual([
      {
        date: '2027-12-24',
        enabled: true,
        closed: false,
        opens: '07:00',
        closes: '19:00',
        note: '',
      },
    ])

    await userEvent.click(within(item).getByRole('checkbox', { name: 'Closed all day' }))
    expect(project().store.specialDates[0].closed).toBe(true)
  })

  it('adds and removes a busy period', async () => {
    renderWithProviders(<StoreScreen />)
    expect(screen.getByText('No busy periods.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add busy period' }))
    expect(project().store.timeRangeMinimums).toMatchObject([
      { dayTypes: ['saturday'], start: '11:00', end: '14:00', minPeople: 2 },
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Remove busy period' }))
    expect(project().store.timeRangeMinimums).toEqual([])
  })

  it('toggles working alone', async () => {
    renderWithProviders(<StoreScreen />)
    await userEvent.click(screen.getByRole('switch', { name: 'Allow someone to work alone' }))
    expect(project().store.allowWorkingAlone).toBe(true)
  })
})
