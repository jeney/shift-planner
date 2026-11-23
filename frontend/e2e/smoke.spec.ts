import { expect, test } from '@playwright/test'

test('app shell loads and language can be switched', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('tab', { name: /Store/ })).toBeVisible()

  await page.getByRole('combobox', { name: 'Language' }).click()
  await page.getByRole('option', { name: 'Magyar' }).click()
  await expect(page.getByRole('tab', { name: /Munkatársak/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('tab', { name: /Munkatársak/ })).toBeVisible()
})

test('backend is reachable through the /api proxy', async ({ page, request }) => {
  test.skip(!process.env.E2E_BASE_URL, 'Needs the full stack (docker compose)')

  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toMatchObject({ status: 'ok' })

  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('Solver online')
})
