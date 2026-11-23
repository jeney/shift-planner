import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n'
import { renderWithProviders } from '@/test/render'

describe('App shell', () => {
  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'ok', version: 'test' })),
    )
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders all planning steps', () => {
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
  })

  it('shows the API as online when /api/health responds', async () => {
    renderWithProviders(<App />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Solver online'))
  })

  it('switches language and persists the choice', async () => {
    renderWithProviders(<App />)
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Language' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Dansk' }))

    expect(await screen.findByRole('tab', { name: /Medarbejdere/ })).toBeInTheDocument()
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('da')
  })
})
