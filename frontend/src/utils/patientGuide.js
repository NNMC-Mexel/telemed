/**
 * Patient guide copy: same contract as the landing page — see
 * `src/config/contentLocales.js`. The four default steps live in the
 * translation bundles, and the CMS override is stored per locale so an admin
 * rewriting the Russian guide no longer replaces the Kazakh and English ones.
 */

import { readLocalizedConfig, writeLocalizedConfig, pickLocaleOverrides } from '../config/contentLocales'

export { pickLocaleOverrides }

/** Keys that mark stored content as the pre-locale single-language shape. */
const GUIDE_KEYS = ['title', 'subtitle', 'welcomeTitle', 'welcomeDescription', 'steps']

/** The guide as it reads with no CMS override — straight from the given
 *  locale's bundle. `t` is any i18next `t`, so the admin can build defaults for
 *  a locale it is not currently viewing with `i18n.getFixedT(locale)`. */
export function buildDefaultPatientGuideConfig(t) {
  return {
    title: t('patient_help.guide_title'),
    subtitle: t('patient_help.guide_subtitle'),
    welcomeTitle: t('patient_help.guide_welcome_title'),
    welcomeDescription: t('patient_help.guide_welcome_desc'),
    steps: [
      {
        title: t('patient_help.guide_step_0_title'),
        description: t('patient_help.guide_step_0_desc'),
        videoUrl: '',
        duration: t('patient_help.guide_duration_2'),
        isActive: true,
      },
      {
        title: t('patient_help.guide_step_1_title'),
        description: t('patient_help.guide_step_1_desc'),
        videoUrl: '',
        duration: t('patient_help.guide_duration_1'),
        isActive: true,
      },
      {
        title: t('patient_help.guide_step_2_title'),
        description: t('patient_help.guide_step_2_desc'),
        videoUrl: '',
        duration: t('patient_help.guide_duration_2'),
        isActive: true,
      },
      {
        title: t('patient_help.guide_step_3_title'),
        description: t('patient_help.guide_step_3_desc'),
        videoUrl: '',
        duration: t('patient_help.guide_duration_1'),
        isActive: true,
      },
    ],
  }
}

/** Deep-merges one locale's CMS override onto that locale's defaults. */
export function mergePatientGuideConfig(base, incoming) {
  const next = {
    ...base,
    ...(incoming || {}),
  }

  next.steps = Array.isArray(incoming?.steps) && incoming.steps.length > 0
    ? incoming.steps.map((step) => ({
        title: step.title || '',
        description: step.description || '',
        videoUrl: step.videoUrl || '',
        duration: step.duration || '',
        isActive: step.isActive !== false,
      }))
    : base.steps

  return next
}

/** Splits stored guide content into per-locale overrides, migrating the
 *  pre-locale shape into the Russian bucket. */
export function readStoredPatientGuide(raw) {
  return readLocalizedConfig(raw, { legacyKeys: GUIDE_KEYS }).overrides
}

/** The inverse of {@link readStoredPatientGuide}: the object to persist. */
export function writeStoredPatientGuide(overrides) {
  return writeLocalizedConfig({}, overrides)
}

/** The guide for the language the visitor is actually reading in. */
export function resolvePatientGuide(t, raw, language) {
  return mergePatientGuideConfig(
    buildDefaultPatientGuideConfig(t),
    pickLocaleOverrides(readStoredPatientGuide(raw), language),
  )
}

export function getVideoEmbedUrl(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    if (hostname === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      const shortsId = parsed.pathname.match(/\/shorts\/([^/]+)/)?.[1]
      if (shortsId) return `https://www.youtube.com/embed/${shortsId}`
      const embedId = parsed.pathname.match(/\/embed\/([^/]+)/)?.[1]
      if (embedId) return `https://www.youtube.com/embed/${embedId}`
    }

    if (hostname === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://player.vimeo.com/video/${id}` : ''
    }

    if (hostname === 'player.vimeo.com' && parsed.pathname.startsWith('/video/')) {
      return url
    }
  } catch {
    return ''
  }

  return ''
}
