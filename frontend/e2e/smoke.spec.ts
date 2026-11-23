import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

const needsBackend = () =>
  test.skip(!process.env.E2E_BASE_URL, 'Needs the full stack (docker compose)')

test('app shell loads and language can be switched', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Plan next month's shifts" })).toBeVisible()

  await page.getByRole('combobox', { name: 'Language' }).click()
  await page.getByRole('option', { name: 'Magyar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Tervezd meg a következő havi beosztást' }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Tervezd meg a következő havi beosztást' }),
  ).toBeVisible()
})

test('backend is reachable through the /api proxy', async ({ page, request }) => {
  needsBackend()
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toMatchObject({ status: 'ok' })

  await page.goto('/')
  await expect(page.getByText('Solver online')).toBeVisible()
})

test('demo project loads, autosaves, and survives a reload', async ({ page }) => {
  needsBackend()
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()
  await expect(page.getByRole('tab', { name: /Employees/ })).toBeVisible()
  await expect(page.getByText('Demo Bakery')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Demo Bakery')).toBeVisible()
})

test('a saved project can be opened in another browser', async ({ page, browser }) => {
  needsBackend()
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()
  await expect(page.getByText('Demo Bakery')).toBeVisible()

  await page.getByRole('button', { name: 'Project' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /Save/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^demo-plan-\d{4}-\d{2}\.shiftplan\.json$/)
  const saved = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(saved.schemaVersion).toBe(2)
  expect(saved.employees).toHaveLength(9)

  // A fresh browser context has no autosave, like opening the file on another computer.
  const context = await browser.newContext()
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.getByRole('heading', { name: "Plan next month's shifts" })).toBeVisible()
  await other
    .getByTestId('project-file-input')
    .first()
    .setInputFiles(await download.path())
  await expect(other.getByText('Demo Bakery')).toBeVisible()
  await expect(other.getByRole('tab', { name: /Employees/ })).toBeVisible()
  await context.close()
})

test('setup screens edit the project and changes persist', async ({ page }) => {
  needsBackend()
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()

  // Store
  await page.getByLabel('Store name').fill('Corner Shop')
  await expect(page.getByRole('banner').getByText('Corner Shop')).toBeVisible()

  // Employees
  await page.getByRole('tab', { name: /Employees/ }).click()
  await page.getByRole('button', { name: 'Add employee' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByLabel('Name').fill('Zoe Test')
  await drawer.getByRole('radio', { name: '10 h' }).click()
  await expect(drawer.getByTestId('target-calculation')).toContainText('43.3 h')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('row', { name: /Zoe Test/ })).toBeVisible()

  // Availability: click a day for the new person
  await page.getByRole('tab', { name: /Availability/ }).click()
  await page.getByRole('combobox', { name: 'Person' }).click()
  await page.getByRole('option', { name: 'Zoe Test' }).click()
  await page.getByRole('gridcell').nth(9).click()
  await expect(page.getByRole('list', { name: 'Availability and wishes' })).toContainText(
    'Unavailable',
  )

  // Advanced
  await page.getByRole('tab', { name: /Advanced settings/ }).click()
  await page.getByRole('radio', { name: '15 min' }).click()

  // Everything survives a reload (autosave).
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByRole('banner').getByText('Corner Shop')).toBeVisible()
  await page.getByRole('tab', { name: /Advanced settings/ }).click()
  await expect(page.getByRole('radio', { name: '15 min' })).toHaveAttribute('aria-checked', 'true')
})
