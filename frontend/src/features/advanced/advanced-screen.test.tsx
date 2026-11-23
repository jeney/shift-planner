import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { AdvancedScreen } from './advanced-screen'

const project = () => useProjectStore.getState().project!

describe('AdvancedScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useProjectStore.setState({ project: makeProject() })
    mockApi({
      'GET /api/health': healthOk,
      'GET /api/project/new': () => Response.json(makeProject({ id: 'fresh' })),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows defaults and edits shift rules', async () => {
    renderWithProviders(<AdvancedScreen />)
    expect(screen.getByRole('radio', { name: '30 min' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('slider', { name: 'Minimum shift length' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    )

    await userEvent.click(screen.getByRole('radio', { name: '15 min' }))
    expect(project().rules.granularityMin).toBe(15)

    await userEvent.click(screen.getByRole('switch', { name: 'At most one shift per day' }))
    expect(project().rules.oneShiftPerDay).toBe(false)
  })

  it('changes the monthly target mode and balancing period', async () => {
    renderWithProviders(<AdvancedScreen />)
    await userEvent.click(screen.getByRole('radio', { name: /Actual weekdays in the month/ }))
    expect(project().rules.monthlyTargetMode).toBe('actual_weekdays')
    await userEvent.click(screen.getByRole('radio', { name: '26' }))
    expect(project().rules.balancingPeriodWeeks).toBe(26)
    expect(screen.getByRole('textbox', { name: 'Custom number of weeks' })).toHaveValue('26')
  })

  it('manages break rules once breaks are enabled', async () => {
    renderWithProviders(<AdvancedScreen />)
    expect(screen.queryByRole('list', { name: 'Break rules' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'Include breaks' }))
    expect(project().rules.breaks.enabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Add break rule' }))
    expect(project().rules.breaks.rules).toHaveLength(2)
    const list = screen.getByRole('list', { name: 'Break rules' })
    await userEvent.click(within(list).getAllByRole('button', { name: 'Remove break rule' })[0])
    expect(project().rules.breaks.rules).toEqual([{ afterHours: 9, minutes: 15 }])
  })

  it('keeps guest-based demand switched off until it is implemented', () => {
    renderWithProviders(<AdvancedScreen />)
    expect(screen.getByRole('switch', { name: 'Use guest-based demand' })).toBeDisabled()
  })

  it('resets every setting to the backend defaults', async () => {
    useProjectStore.getState().updateProject((p) => {
      p.rules.maxWeeklyHours = 40
      p.weights.wishOff = 99
      p.solver.timeLimitSeconds = 5
      p.guestDemand.guestsByDate = { '2027-02-01': 1200 }
    })
    renderWithProviders(<AdvancedScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Reset to defaults',
      }),
    )
    await screen.findByText('Settings reset to defaults')
    expect(project().rules.maxWeeklyHours).toBe(48)
    expect(project().weights.wishOff).toBe(10)
    expect(project().solver.timeLimitSeconds).toBe(20)
    // Per-day guest counts are data, not settings: they survive a reset.
    expect(project().guestDemand.guestsByDate).toEqual({ '2027-02-01': 1200 })
    expect(project().id).toBe('project-1')
  })
})
