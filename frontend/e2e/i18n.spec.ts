import { expect, test, type Page } from '@playwright/test'

const NAMESPACES = [
  'app',
  'header',
  'api',
  'steps',
  'stepDescriptions',
  'empty',
  'project',
  'welcome',
  'errors',
  'common',
  'units',
  'dayTypes',
  'dayTypesShort',
  'calendar',
  'store',
  'rules',
  'employees',
  'availability',
  'advanced',
  'weights',
  'guestDemand',
  'solver',
  'generate',
  'violation',
  'diagnostic',
  'plan',
  'export',
]
const RAW_KEY = new RegExp(`\\b(${NAMESPACES.join('|')})\\.[A-Za-z_][A-Za-z_.]+`)

/** Distinctive English UI text that must not leak into other languages. */
const ENGLISH = [
  'Opening hours',
  'Special dates',
  'Staffing needs',
  'Add employee',
  'Hours per week',
  'Availability & wishes',
  'Clicking adds',
  'Generate plan',
  'Before you generate',
  'Advanced settings',
  'Planner priorities',
  'Export the plan',
  'Hours this month',
  'Undo',
  'Things to check',
  'Per day',
  'Expected guests',
  'Coming soon',
]

const LANGUAGES = [
  {
    option: 'Dansk',
    lang: 'da',
    title: 'Vagtplanlægger',
    generate: 'Generér plan',
    tabs: [
      'Butik',
      'Medarbejdere',
      'Tilgængelighed',
      'Generér',
      'Vagtplan',
      'Eksport',
      'Avancerede',
    ],
  },
  {
    option: 'Magyar',
    lang: 'hu',
    title: 'Beosztástervező',
    generate: 'Beosztás készítése',
    tabs: [
      'Üzlet',
      'Munkatársak',
      'Elérhetőség',
      'Generálás',
      'Beosztás',
      'Exportálás',
      'Speciális',
    ],
  },
]

async function checkPage(page: Page, where: string) {
  const text = await page.locator('body').innerText()
  expect.soft(text.match(RAW_KEY)?.[0] ?? null, `raw translation key on ${where}`).toBeNull()
  for (const english of ENGLISH) {
    expect.soft(text.includes(english), `"${english}" left in English on ${where}`).toBe(false)
  }
}

for (const { option, lang, title, generate, tabs } of LANGUAGES) {
  test(`every screen is translated – ${lang}`, async ({ page }) => {
    test.skip(!process.env.E2E_BASE_URL, 'Needs the full stack (docker compose)')
    test.setTimeout(120_000)
    await page.goto('/')
    await page.getByRole('combobox').first().click()
    await page.getByRole('option', { name: option }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await expect(page).toHaveTitle(title)
    await checkPage(page, 'welcome')

    await page
      .getByRole('button', { name: /dem[oó]/i })
      .first()
      .click()
    await page.getByRole('tab', { name: new RegExp(tabs[5]) }).waitFor()
    // Turn on guest demand so its section is checked too.
    await page.getByRole('tab', { name: new RegExp(tabs[6]) }).click()
    await page
      .getByRole('switch')
      .filter({ has: page.locator('[data-state]') })
      .last()
      .click()
    for (const tab of tabs) {
      await page.getByRole('tab', { name: new RegExp(tab) }).click()
      await page.waitForTimeout(600)
      await checkPage(page, tab)
    }

    await page.getByRole('tab', { name: new RegExp(tabs[3]) }).click()
    await page.getByRole('button', { name: generate }).click()
    await page.getByRole('tab', { name: new RegExp(tabs[4]) }).click()
    await page.getByRole('grid').waitFor({ timeout: 60_000 })
    await page.waitForTimeout(800)
    await checkPage(page, 'plan grid')
  })
}
