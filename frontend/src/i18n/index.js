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
    lng: 'ru',
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'kk', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
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
