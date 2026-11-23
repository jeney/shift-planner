import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const TABS = [
  /Store/,
  /Employees/,
  /Availability/,
  /Generate/,
  /Plan/,
  /Export/,
  /Advanced settings/,
] as const

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map(
    (v) =>
      `${label} · ${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')}`,
  )
  expect.soft(summary, summary.join('\n')).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibility (WCAG 2.1 AA) – ${scheme}`, async ({ page }) => {
    test.skip(!process.env.E2E_BASE_URL, 'Needs the full stack (docker compose)')
    test.setTimeout(180_000)
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await audit(page, 'welcome')
    await page.getByRole('button', { name: 'Load demo project' }).click()
    await page.getByRole('tab', { name: /Plan/ }).waitFor()
    for (const tab of TABS) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(500)
      await audit(page, String(tab))
    }

    // Richer states: dialogs, a generated plan and its grid.
    await page.getByRole('tab', { name: /Employees/ }).click()
    await page.getByRole('button', { name: 'Edit Sophie' }).click()
    await page.getByRole('dialog').waitFor()
    await audit(page, 'employee drawer')
    await page.keyboard.press('Escape')

    await page.getByRole('tab', { name: /Availability/ }).click()
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('dialog').waitFor()
    await audit(page, 'availability dialog')
    await page.keyboard.press('Escape')

    await page.getByRole('tab', { name: /Generate/ }).click()
    await page.getByRole('button', { name: 'Generate plan' }).click()
    await page.getByText(/^(Best possible|Good) plan found$/).waitFor({ timeout: 60_000 })
    await audit(page, 'generate result')
    await page.getByRole('tab', { name: /Plan/ }).click()
    await page.getByRole('grid', { name: 'Shift plan' }).waitFor()
    await page.waitForTimeout(800)
    await audit(page, 'plan grid')
  })
}
