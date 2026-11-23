import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import da from './locales/da.json'
import en from './locales/en.json'
import hu from './locales/hu.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'da', label: 'Dansk', short: 'DA' },
  { code: 'hu', label: 'Magyar', short: 'HU' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const LANGUAGE_STORAGE_KEY = 'shift-planner.language'

export const resources = {
  en: { translation: en },
  da: { translation: da },
  hu: { translation: hu },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  document.title = i18n.t('app.name')
})

export default i18n
