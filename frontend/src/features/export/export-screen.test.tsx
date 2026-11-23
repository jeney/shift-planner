import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeCalendar, makeEmployee, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

import { ExportScreen } from './export-screen'

describe('ExportScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useProjectStore.setState({
      project: makeProject({
        employees: [makeEmployee({ id: 'a', name: 'Anna' })],
        plan: {
          shifts: [
            {
              id: '1',
              employeeId: 'a',
              date: '2027-02-01',
              start: '06:00',
              end: '14:00',
              pinned: false,
            },
          ],
        },
      }),
    })
    mockApi({
      'GET /api/health': healthOk,
      'GET /api/calendar/2027-02': () => Response.json(makeCalendar('2027-02')),
      'POST /api/validate': () => Response.json({ violations: [], stats: [], wishes: [] }),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows an empty state without a plan', () => {
    useProjectStore.getState().updateProject((p) => {
      p.plan = null
    })
    renderWithProviders(<ExportScreen />)
    expect(screen.getByText('Nothing to export yet')).toBeInTheDocument()
  })

  it('downloads spreadsheets and prints the plan', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderWithProviders(<ExportScreen />)

    const xlsx = screen.getByRole('button', { name: 'Download for Excel (.xlsx)' })
    await waitFor(() => expect(xlsx).toBeEnabled())
    await userEvent.click(xlsx)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(await screen.findByText('Downloaded test-store-plan-2027-02.xlsx')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Download for LibreOffice (.ods)' }))
    expect(createObjectURL).toHaveBeenCalledTimes(2)

    await userEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledOnce()
    expect(screen.getByTestId('print-view')).toHaveTextContent('Test Store')
    expect(screen.getByTestId('print-view')).toHaveTextContent('Anna')
  })
})
