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
  expect(saved.schemaVersion).toBe(3)
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

test('generates a plan for the demo team', async ({ page }) => {
  needsBackend()
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()

  await page.getByRole('tab', { name: /Generate/ }).click()
  await page.getByRole('button', { name: 'Generate plan' }).click()
  await expect(page.getByText(/^(Best possible|Good) plan found$/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('table', { name: 'Hours per person' })).toContainText('Sophie')
  await expect(page.getByRole('button', { name: 'Generate again' })).toBeVisible()
})

test('an impossible month gets diagnostics and a best-effort plan', async ({ page }) => {
  needsBackend()
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()

  // The demo already needs 2 people 11–14 on Saturdays; ask for 12 (only 9 people exist).
  const minimum = page.getByLabel('Minimum people')
  await minimum.fill('12')
  await minimum.blur()

  await page.getByRole('tab', { name: /Generate/ }).click()
  const precheck = page.getByRole('list', { name: 'Before you generate' })
  await expect(precheck).toContainText('too few people available for the busy period')
  await page.getByRole('button', { name: 'Generate plan' }).click()
  await expect(page.getByText("No plan follows every rule. Here's the closest one")).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByRole('list', { name: 'Things to check' })).toContainText(
    'too few people for the busy period',
  )
})

test('edit the plan by hand with live checks, undo, and keep edits when re-generating', async ({
  page,
}) => {
  needsBackend()
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()
  await page.getByRole('tab', { name: /Generate/ }).click()
  await page.getByRole('button', { name: 'Generate plan' }).click()
  await expect(page.getByText(/^(Best possible|Good) plan found$/)).toBeVisible({ timeout: 60_000 })

  await page.getByRole('tab', { name: /Plan/ }).click()
  const grid = page.getByRole('grid', { name: 'Shift plan' })
  const cell = grid.getByRole('gridcell', { name: /^Sophie, \w+, \w+ 3\./ })
  await cell.click()
  await page.getByLabel('Start').fill('06:00')
  await page.getByLabel('End').fill('17:00') // 11 h: longer than the 8 h maximum
  await page.getByRole('button', { name: /^(Save|Add shift)$/ }).click()

  await expect(cell).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('status').filter({ hasText: /rules? broken/ })).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(cell).not.toHaveAttribute('aria-invalid', 'true')

  // A valid pinned edit survives re-generation.
  await cell.click()
  await page.getByLabel('Start').fill('09:00')
  await page.getByLabel('End').fill('13:00')
  await page.getByRole('button', { name: /^(Save|Add shift)$/ }).click()
  await page.getByRole('button', { name: 'Re-generate, keeping 1 edit' }).click()
  await expect(page.getByRole('button', { name: 'Re-generate, keeping 1 edit' })).toBeEnabled({
    timeout: 60_000,
  })
  await expect(cell).toContainText('09:00–13:00')
})

test('exports the plan as .ods, .xlsx and a printable A4 page', async ({ page }) => {
  needsBackend()
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()
  await page.getByRole('tab', { name: /Generate/ }).click()
  await page.getByRole('button', { name: 'Generate plan' }).click()
  await expect(page.getByText(/^(Best possible|Good) plan found$/)).toBeVisible({ timeout: 60_000 })
  await page.getByRole('tab', { name: /Export/ }).click()

  for (const [button, extension] of [
    ['Download for LibreOffice (.ods)', 'ods'],
    ['Download for Excel (.xlsx)', 'xlsx'],
  ] as const) {
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: button }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^demo-bakery-plan-\\d{4}-\\d{2}\\.${extension}$`),
    )
    const bytes = await readFile(await download.path())
    expect(bytes.subarray(0, 2).toString()).toBe('PK') // a zip package
  }

  // The print view is hidden on screen and is the only thing shown when printing.
  await expect(page.getByTestId('print-view')).toBeHidden()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByTestId('print-view')).toBeVisible()
  await expect(page.getByTestId('print-view')).toContainText('Sophie')
  const pdf = await page.pdf({ preferCSSPageSize: true })
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
})

test('guest-based demand turns guest counts into daily targets', async ({ page }) => {
  needsBackend()
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()
  await page.getByRole('tab', { name: /Advanced settings/ }).click()
  await page.getByRole('switch', { name: 'Use guest-based demand' }).click()
  await page.getByRole('tab', { name: /Store/ }).click()
  const guests = page.getByRole('list', { name: 'Expected guests' }).getByRole('textbox').first()
  await guests.fill('1250')
  await expect(page.getByText('→ 25 h')).toBeVisible()
  await page.waitForTimeout(600)
  await page.reload()
  await page.getByRole('tab', { name: /Store/ }).click()
  await expect(page.getByText('→ 25 h')).toBeVisible()
})

test('starts the next month with the same team', async ({ page }) => {
  needsBackend()
  await page.goto('/')
  await page.getByRole('button', { name: 'Load demo project' }).click()
  const badge = page.getByRole('banner').locator('[data-slot="badge"]')
  const before = await badge.innerText()

  await page.getByRole('button', { name: 'Project' }).click()
  await page.getByRole('menuitem', { name: 'Start next month…' }).click()
  await page.getByRole('button', { name: 'Start next month' }).click()

  await expect(badge).not.toHaveText(before)
  await page.getByRole('tab', { name: /Employees/ }).click()
  await expect(page.getByText('Sophie', { exact: true })).toBeVisible()
  // Sophie's balancing period moved on from week 6.
  await expect(page.getByRole('row', { name: /Sophie/ })).not.toContainText('6 of 16')
})
