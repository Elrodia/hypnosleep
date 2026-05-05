import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import fr from './locales/fr.json'

/**
 * Supported UI languages. Each entry is the ISO 639-1 code.
 *
 * Adding a new language is two steps:
 *   1. Drop a `<code>.json` file in `src/i18n/locales/` matching
 *      en.json's structure.
 *   2. Add it to SUPPORTED_LANGUAGES below and to the `resources`
 *      block of i18n.init().
 *
 * This keeps the architecture honest about what we have validated
 * native-speaker support for.
 */
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<SupportedLanguage, { native: string; code: string }> = {
  en: { native: 'English', code: 'EN' },
  fr: { native: 'Français', code: 'FR' },
}

const STORAGE_KEY = 'hypnosleep:lang'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false, // we ship JSON inline, no async fetch
    },
  })

export default i18n
