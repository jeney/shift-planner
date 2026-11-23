import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeCalendar, makeEmployee, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { EmployeesScreen } from './employees-screen'

const project = () => useProjectStore.getState().project!

describe('EmployeesScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    mockApi({
      'GET /api/health': healthOk,
      'GET /api/calendar/2027-02': () => Response.json(makeCalendar('2027-02')),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('adds an employee from the empty state and opens the editor', async () => {
    useProjectStore.setState({ project: makeProject() })
    renderWithProviders(<EmployeesScreen />)
    expect(screen.getByText('No employees yet')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Add employee' })[0])
    expect(project().employees).toHaveLength(1)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Employee 1')
  })

  it('lists employees with their monthly target and team totals', async () => {
    useProjectStore.setState({
      project: makeProject({
        employees: [
          makeEmployee({ id: 'a', name: 'Anna', contractHoursPerWeek: 10, hasCar: true }),
          makeEmployee({ id: 'b', name: 'Bo', contractHoursPerWeek: 20, active: false }),
        ],
      }),
    })
    renderWithProviders(<EmployeesScreen />)
    const anna = screen.getByText('Anna').closest('tr')!
    expect(await within(anna).findByText('43.3 h')).toBeInTheDocument()
    expect(within(screen.getByText('Bo').closest('tr')!).getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText('1 active person')).toBeInTheDocument()
  })

  it('shows the target calculation and updates it from a preset', async () => {
    useProjectStore.setState({
      project: makeProject({
        employees: [makeEmployee({ name: 'Anna', contractHoursPerWeek: 10 })],
      }),
    })
    renderWithProviders(<EmployeesScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Anna' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByTestId('target-calculation')).toHaveTextContent(
      '10 h/week × 52/12 → 43.3 h this month',
    )
    await userEvent.click(within(dialog).getByRole('radio', { name: '40 h' }))
    expect(project().employees[0].contractHoursPerWeek).toBe(40)
    expect(within(dialog).getByTestId('target-calculation')).toHaveTextContent('→ 173.3 h')
  })

  it('restricts who may drive someone who needs a ride', async () => {
    useProjectStore.setState({
      project: makeProject({
        employees: [
          makeEmployee({ id: 'a', name: 'Anna', needsRideEarly: true }),
          makeEmployee({ id: 'b', name: 'Bo', hasCar: true }),
          makeEmployee({ id: 'c', name: 'Cy', hasCar: true }),
        ],
      }),
    })
    renderWithProviders(<EmployeesScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Anna' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Only these people' }))
    expect(project().employees[0].allowedDriverIds).toEqual(['b', 'c'])
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Cy' }))
    expect(project().employees[0].allowedDriverIds).toEqual(['b'])
  })

  it('deletes an employee together with their availability and driver references', async () => {
    useProjectStore.setState({
      project: makeProject({
        employees: [
          makeEmployee({ id: 'a', name: 'Anna', needsRideEarly: true, allowedDriverIds: ['b'] }),
          makeEmployee({ id: 'b', name: 'Bo', hasCar: true }),
        ],
        availability: [
          {
            id: 'x',
            employeeId: 'b',
            kind: 'unavailable',
            pattern: { type: 'weekly', weekday: 0, start: null, end: null },
            weight: 1,
            note: '',
          },
        ],
      }),
    })
    renderWithProviders(<EmployeesScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Bo' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete employee' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Delete employee',
      }),
    )
    expect(project().employees.map((e) => e.id)).toEqual(['a'])
    expect(project().availability).toEqual([])
    expect(project().employees[0].allowedDriverIds).toEqual([])
  })
})
