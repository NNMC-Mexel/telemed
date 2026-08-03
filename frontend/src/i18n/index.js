import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ru from './locales/ru/translation.json'
import kk from './locales/kk/translation.json'
import en from './locales/en/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      kk: { translation: kk },
      en: { translation: en },
    },
    // No `lng` here on purpose: i18next skips the detector whenever an explicit
    // language is set, which silently threw away the visitor's saved choice on
    // every page load. `fallbackLng` gives first-time visitors Russian instead.
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'kk', 'en'],
    // `kk-KZ` from a browser has to resolve to the `kk` bundle we ship.
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      // Only what the visitor picked here — reading `navigator` would hand an
      // English-locale browser an English site on first visit, which is not
      // the default this clinic wants.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export const LANGUAGES = [
  { code: 'ru', label: 'Рус', fullLabel: 'Русский' },
  { code: 'kk', label: 'Қаз', fullLabel: 'Қазақша' },
  { code: 'en', label: 'Eng', fullLabel: 'English' },
]

export default i18n
