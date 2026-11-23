import { describe, expect, it } from 'vitest'

import da from './locales/da.json'
import en from './locales/en.json'
import hu from './locales/hu.json'

function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flattenKeys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe('locales', () => {
  const reference = flattenKeys(en).sort()

  it.each([
    ['da', da],
    ['hu', hu],
  ])('%s has exactly the same keys as en', (_code, locale) => {
    expect(flattenKeys(locale).sort()).toEqual(reference)
  })
})
