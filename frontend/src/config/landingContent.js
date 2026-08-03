/**
 * Landing copy: the contract between the i18n bundles and the CMS.
 *
 * Every string on the landing page exists twice — once as a translation key, so
 * the page speaks all three languages out of the box, and once as an optional
 * CMS override the admin types in. The override therefore has to be *per
 * locale*: a single flat override silently pins the whole page to whichever
 * language it was written in, whatever the visitor picked.
 *
 * Stored shape (`global.landingConfig`):
 *
 *   { heroVariant: 'ink', ru: { hero: {…}, … }, kk: { … }, en: { … } }
 *
 * `heroVariant` is a design choice, not copy, so it stays shared. Anything a
 * locale does not override falls back to that locale's translation bundle —
 * an empty `kk` block means the Kazakh page reads from `kk/translation.json`,
 * which is exactly what we want.
 *
 * The pre-locale shape (sections at the top level) is still read: it is treated
 * as the Russian override, so existing CMS content survives the migration and
 * kk/en immediately start rendering their translations.
 */

import { DEFAULT_HERO_VARIANT, resolveHeroVariant } from './heroVariants'
import { CONTENT_LOCALES, readLocalizedConfig, writeLocalizedConfig } from './contentLocales'

export { pickLocaleOverrides } from './contentLocales'

export const LANDING_LOCALES = CONTENT_LOCALES

/** Keys that mark a stored object as the old single-language shape. */
const SECTION_KEYS = ['hero', 'heroCard', 'stats', 'featuresSection', 'stepsSection', 'aboutSection', 'contactSection']

/** The landing copy as it reads with no CMS override at all — i.e. straight
 *  from the given locale's translation bundle. `t` is any i18next `t`, so the
 *  admin can build defaults for a locale it is not currently viewing with
 *  `i18n.getFixedT(locale)`. */
export function buildDefaultLandingConfig(t) {
    return {
        hero: {
            badge: t('landing.hero.badge'),
            titlePrefix: t('landing.hero.title_prefix'),
            titleHighlight: t('landing.hero.title_highlight'),
            description: t('landing.hero.description'),
            primaryButtonLabel: t('landing.hero.find_doctor'),
            secondaryButtonLabel: t('landing.hero.register'),
        },
        heroCard: {
            title: t('landing.hero_card.title'),
            subtitle: t('landing.hero_card.subtitle'),
            items: [
                { title: t('landing.hero_card.item_0_title'), description: t('landing.hero_card.item_0_desc') },
                { title: t('landing.hero_card.item_1_title'), description: t('landing.hero_card.item_1_desc') },
                { title: t('landing.hero_card.item_2_title'), description: t('landing.hero_card.item_2_desc') },
            ],
            buttonLabel: t('landing.hero_card.book_now'),
        },
        stats: [
            { value: '1100+', label: t('landing.stats.consultations') },
            { value: '6+', label: t('landing.stats.doctors') },
            { value: '4.9', label: t('landing.stats.avg_rating') },
            { value: '98%', label: t('landing.stats.satisfaction') },
        ],
        featuresSection: {
            badge: t('landing.features.badge'),
            title: t('landing.features.title'),
            subtitle: t('landing.features.subtitle'),
            cards: [
                { title: t('landing.features.card_0_title'), description: t('landing.features.card_0_desc') },
                { title: t('landing.features.card_1_title'), description: t('landing.features.card_1_desc') },
                { title: t('landing.features.card_2_title'), description: t('landing.features.card_2_desc') },
                { title: t('landing.features.card_3_title'), description: t('landing.features.card_3_desc') },
            ],
        },
        stepsSection: {
            badge: t('landing.steps.badge'),
            title: t('landing.steps.title'),
            subtitle: t('landing.steps.subtitle'),
            steps: [
                { title: t('landing.steps.step_0_title'), description: t('landing.steps.step_0_desc') },
                { title: t('landing.steps.step_1_title'), description: t('landing.steps.step_1_desc') },
                { title: t('landing.steps.step_2_title'), description: t('landing.steps.step_2_desc') },
                { title: t('landing.steps.step_3_title'), description: t('landing.steps.step_3_desc') },
            ],
        },
        aboutSection: {
            badge: t('landing.about.badge'),
            title: t('landing.about.title'),
            description: t('landing.about.description'),
            bullets: [
                t('landing.about.bullet_0'),
                t('landing.about.bullet_1'),
                t('landing.about.bullet_2'),
                t('landing.about.bullet_3'),
            ],
            buttonLabel: t('landing.about.join'),
        },
        contactSection: {
            badge: t('landing.contact.badge'),
            title: t('landing.contact.title'),
            subtitle: t('landing.contact.subtitle'),
            phone: {
                title: t('landing.contact.phone_title'),
                note: t('landing.contact.phone_note'),
                value: '+7 (717) 270-12-34',
            },
            email: {
                title: t('landing.contact.email_title'),
                note: t('landing.contact.email_note'),
                value: 'info@medconnect.kz',
            },
            address: {
                title: t('landing.contact.address_title'),
                note: t('landing.contact.address_note'),
                value: t('footer.address'),
            },
            quickCard: {
                title: t('landing.contact.quick_title'),
                description: t('landing.contact.quick_desc'),
                bullets: [
                    t('landing.contact.quick_bullet_0'),
                    t('landing.contact.quick_bullet_1'),
                    t('landing.contact.quick_bullet_2'),
                ],
                buttonLabel: t('landing.contact.quick_button'),
            },
            mapEmbedUrl:
                'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2505.5!2d71.4926513!3d51.1492038!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4245817a521995c9%3A0xe653c982ba77912!2z0J3QsNGG0LjQvtC90LDQu9GM0L3Ri9C5INC90LDRg9GH0L3Ri9C5INC80LXQtNC40YbQuNC90YHQutC40Lkg0YbQtdC90YLRgA!5e0!3m2!1sru!2skz!4v1700000000000!5m2!1sru!2skz',
        },
    }
}

/** Deep-merges a CMS override onto the translated defaults. Empty arrays count
 *  as "not overridden" so a cleared textarea restores the translation instead
 *  of blanking a section. */
export function mergeLandingConfig(base, incoming) {
    const pickList = (list, fallback) => (Array.isArray(list) && list.length > 0 ? list : fallback)

    return {
        ...base,
        ...(incoming || {}),
        hero: { ...base.hero, ...(incoming?.hero || {}) },
        heroCard: {
            ...base.heroCard,
            ...(incoming?.heroCard || {}),
            items: pickList(incoming?.heroCard?.items, base.heroCard.items),
        },
        stats: pickList(incoming?.stats, base.stats),
        featuresSection: {
            ...base.featuresSection,
            ...(incoming?.featuresSection || {}),
            cards: pickList(incoming?.featuresSection?.cards, base.featuresSection.cards),
        },
        stepsSection: {
            ...base.stepsSection,
            ...(incoming?.stepsSection || {}),
            steps: pickList(incoming?.stepsSection?.steps, base.stepsSection.steps),
        },
        aboutSection: {
            ...base.aboutSection,
            ...(incoming?.aboutSection || {}),
            bullets: pickList(incoming?.aboutSection?.bullets, base.aboutSection.bullets),
        },
        contactSection: {
            ...base.contactSection,
            ...(incoming?.contactSection || {}),
            phone: { ...base.contactSection.phone, ...(incoming?.contactSection?.phone || {}) },
            email: { ...base.contactSection.email, ...(incoming?.contactSection?.email || {}) },
            address: { ...base.contactSection.address, ...(incoming?.contactSection?.address || {}) },
            quickCard: {
                ...base.contactSection.quickCard,
                ...(incoming?.contactSection?.quickCard || {}),
                bullets: pickList(
                    incoming?.contactSection?.quickCard?.bullets,
                    base.contactSection.quickCard.bullets,
                ),
            },
        },
    }
}

/** Normalises whatever the CMS returns into `{ heroVariant, overrides }`,
 *  where `overrides` is keyed by locale. Understands both the current shape and
 *  the pre-locale one. */
export function readStoredLandingConfig(raw) {
    const { shared, overrides } = readLocalizedConfig(raw, {
        legacyKeys: SECTION_KEYS,
        sharedKeys: ['heroVariant'],
    })
    return { heroVariant: resolveHeroVariant(shared.heroVariant), overrides }
}

/** The inverse of {@link readStoredLandingConfig}: the object to persist. */
export function writeStoredLandingConfig(heroVariant, overrides) {
    return writeLocalizedConfig({ heroVariant: resolveHeroVariant(heroVariant) }, overrides)
}

export { DEFAULT_HERO_VARIANT }
