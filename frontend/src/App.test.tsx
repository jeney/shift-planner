import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n'
import { useProjectStore } from '@/project/store'
import { makeEmployee, makeProject } from '@/test/fixtures'
import { healthOk, mockApi } from '@/test/mock-api'
import { renderWithProviders } from '@/test/render'

describe('App', () => {
  beforeEach(async () => {
    useProjectStore.setState({ project: null })
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the welcome screen without a project', () => {
    mockApi({ 'GET /api/health': healthOk })
    renderWithProviders(<App />)
    expect(screen.getByRole('heading', { name: "Plan next month's shifts" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load demo project' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('shows all planning steps once a project is loaded', () => {
    mockApi({ 'GET /api/health': healthOk })
    useProjectStore.setState({ project: makeProject() })
    renderWithProviders(<App />)
    for (const name of [
      /Store/,
      /Employees/,
      /Availability & wishes/,
      /Generate/,
      /Plan/,
      /Export/,
      /Advanced settings/,
    ]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Test Store')).toBeInTheDocument()
  })

  it('loads the demo project from the API', async () => {
    const demo = makeProject({ name: 'Demo plan', employees: [makeEmployee()] })
    const fetchMock = mockApi({
      'GET /api/health': healthOk,
      'GET /api/project/demo': () => Response.json(demo),
    })
    renderWithProviders(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Load demo project' }))

    expect(await screen.findByRole('tab', { name: /Employees/ })).toBeInTheDocument()
    expect(useProjectStore.getState().project).toEqual(demo)
    const demoCall = fetchMock.mock.calls.find(([req]) =>
      String((req as Request).url).includes('/api/project/demo'),
    )
    expect(new URL((demoCall![0] as Request).url).searchParams.get('month')).toMatch(
      /^\d{4}-\d{2}$/,
    )
  })

  it('shows a translated error when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    renderWithProviders(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Load demo project' }))
    expect(await screen.findByText(/Can't reach the planning service/)).toBeInTheDocument()
    expect(useProjectStore.getState().project).toBeNull()
  })

  it('shows the API as online when /api/health responds', async () => {
    mockApi({ 'GET /api/health': healthOk })
    renderWithProviders(<App />)
    await waitFor(() =>
      expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Solver online'),
    )
  })

  it('switches language and persists the choice', async () => {
    mockApi({ 'GET /api/health': healthOk })
    renderWithProviders(<App />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Dansk' }))

    expect(
      await screen.findByRole('heading', { name: 'Planlæg næste måneds vagter' }),
    ).toBeInTheDocument()
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('da')
  })
})
