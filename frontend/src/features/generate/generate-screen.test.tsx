import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SolveResponse } from '@/api/types'
import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeEmployee, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { GenerateScreen } from './generate-screen'
import { useSolveStore } from './use-solve'

const response: SolveResponse = {
  status: 'optimal',
  plan: {
    shifts: [
      {
        id: 's1',
        employeeId: 'a',
        date: '2027-02-01',
        start: '06:00',
        end: '14:00',
        pinned: false,
      },
    ],
  },
  violations: [
    {
      rule: 'weekly_above_contract',
      severity: 'warning',
      employeeId: 'a',
      date: '2027-02-01',
      start: null,
      end: null,
      amount: 3,
      params: { planned: 40, contract: 37 },
    },
  ],
  diagnostics: [],
  stats: [
    {
      employeeId: 'a',
      shifts: 22,
      plannedHours: 171.5,
      targetHours: 173.33,
      deviationHours: -1.83,
      carryInHours: 3.5,
      newBalanceHours: 1.67,
      wishesHonoured: 2,
      wishesTotal: 2,
    },
  ],
  wishes: [],
  solveTimeMs: 18200,
}

describe('GenerateScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSolveStore.setState({ result: null, projectId: null })
    useProjectStore.setState({
      project: makeProject({ employees: [makeEmployee({ id: 'a', name: 'Anna' })] }),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('generates a plan, stores it and shows the summary', async () => {
    const fetchMock = mockApi({
      'GET /api/health': healthOk,
      'POST /api/solve': () => Response.json(response),
    })
    renderWithProviders(<GenerateScreen />)
    expect(screen.getByText('1 person')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Generate plan' }))

    expect(await screen.findByText('Best possible plan found')).toBeInTheDocument()
    expect(screen.getByText('1 shifts · 2 of 2 wish days honoured · 18.2 s')).toBeInTheDocument()
    expect(useProjectStore.getState().project?.plan?.shifts).toHaveLength(1)

    // The request carries the inputs, not an old plan.
    const solveCall = fetchMock.mock.calls.find(([r]) => (r as Request).url.endsWith('/api/solve'))
    const body = await (solveCall![0] as Request).json()
    expect(body.plan).toBeNull()

    const issues = screen.getByRole('list', { name: 'Things to check' })
    expect(issues).toHaveTextContent(
      'Anna works 40 h in the week of Mon, Feb 1, above the 37 h contract.',
    )
    const row = within(screen.getByRole('table', { name: 'Hours per person' }))
      .getByText('Anna')
      .closest('tr')!
    expect(row).toHaveTextContent('171.5 h')
    expect(row).toHaveTextContent('+1.7 h')
    expect(screen.getByRole('button', { name: 'Generate again' })).toBeInTheDocument()
  })

  it('explains a time-out without a plan', async () => {
    mockApi({
      'GET /api/health': healthOk,
      'POST /api/solve': () =>
        Response.json({
          ...response,
          status: 'infeasible',
          plan: null,
          violations: [],
          stats: [],
          diagnostics: [
            { code: 'solver.timeout', severity: 'error', date: null, employeeIds: [], params: {} },
          ],
        }),
    })
    renderWithProviders(<GenerateScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Generate plan' }))
    expect(await screen.findByText('No plan found in time')).toBeInTheDocument()
    expect(useProjectStore.getState().project?.plan).toBeNull()
  })
})
