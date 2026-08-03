/**
 * Locale plumbing for admin-editable content.
 *
 * Anything the admin can rewrite through the CMS has to be stored per language,
 * otherwise the first person to edit the page pins it to whatever language they
 * typed in and the switcher stops doing anything for that block. Both the
 * landing copy and the patient guide use the shape built here:
 *
 *   { <shared keys…>, ru: { … }, kk: { … }, en: { … } }
 *
 * A locale with no block of its own falls through to its translation bundle, so
 * "not translated by the admin yet" reads as the shipped translation rather
 * than as another language's text.
 */

export const CONTENT_LOCALES = ['ru', 'kk', 'en']

export const DEFAULT_CONTENT_LOCALE = 'ru'

/** `kk`, `kk-KZ` and `KK` all mean the same bucket; anything we ship no bundle
 *  for falls back to Russian, matching i18next's `fallbackLng`. */
export function normalizeContentLocale(language) {
  const base = String(language || '').toLowerCase().split('-')[0]
  return CONTENT_LOCALES.includes(base) ? base : DEFAULT_CONTENT_LOCALE
}

/**
 * Splits stored CMS content into shared values and per-locale overrides.
 *
 * @param raw        whatever the CMS returned
 * @param legacyKeys keys whose presence at the top level marks the pre-locale
 *                   single-language shape — that content was written in Russian
 *                   and is migrated into the `ru` bucket
 * @param sharedKeys keys that are not copy (a design choice, a flag) and so
 *                   stay outside the per-locale blocks
 */
export function readLocalizedConfig(raw, { legacyKeys = [], sharedKeys = [] } = {}) {
  const stored = raw && typeof raw === 'object' ? raw : {}

  const shared = {}
  sharedKeys.forEach((key) => {
    shared[key] = stored[key]
  })

  const overrides = {}
  CONTENT_LOCALES.forEach((locale) => {
    overrides[locale] = stored[locale] && typeof stored[locale] === 'object' ? stored[locale] : {}
  })

  // An explicit `ru` block always wins: it means the content has already been
  // migrated and any leftover top-level keys are stale.
  const isLegacy = legacyKeys.some((key) => stored[key] !== undefined && stored[key] !== null)
  if (isLegacy && Object.keys(overrides.ru).length === 0) {
    const sections = { ...stored }
    ;[...sharedKeys, ...CONTENT_LOCALES].forEach((key) => delete sections[key])
    overrides.ru = sections
  }

  return { shared, overrides }
}

/** The inverse of {@link readLocalizedConfig}: the object to persist. */
export function writeLocalizedConfig(shared, overrides) {
  const stored = { ...(shared || {}) }
  CONTENT_LOCALES.forEach((locale) => {
    stored[locale] = overrides?.[locale] || {}
  })
  return stored
}

/** The override block for the language the visitor is actually reading in. */
export function pickLocaleOverrides(overrides, language) {
  return overrides?.[normalizeContentLocale(language)] || {}
}
