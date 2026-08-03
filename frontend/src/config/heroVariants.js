/**
 * Hero designs the admin can switch between.
 *
 * A variant is a *theme*, never a second layout. The hero always renders the
 * same DOM; everything a variant changes — backdrop, text colours, card surface
 * — is a CSS custom property under `[data-hero-variant="…"]` in index.css. That
 * is what keeps the picker safe: grid, spacing and breakpoints are shared by
 * every variant, so switching one cannot break the composition.
 *
 * To add a design:
 *   1. add an entry here — `id` is the value written to `data-hero-variant`;
 *   2. add the matching `.hero-clinical[data-hero-variant="id"]` block in
 *      index.css, overriding only tokens and the backdrop layers;
 *   3. add the two label keys to every locale.
 * The landing page and the admin picker both read this list, so nothing else
 * needs to know the design exists.
 */

export const DEFAULT_HERO_VARIANT = 'ink'

export const HERO_VARIANTS = [
    {
        id: 'ink',
        labelKey: 'admin_content.hero_variant_ink',
        descriptionKey: 'admin_content.hero_variant_ink_note',
        // The public nav sits directly on the hero until the first scroll, so a
        // dark backdrop has to flip it to light type.
        headerOnDark: true,
    },
    {
        id: 'split',
        labelKey: 'admin_content.hero_variant_split',
        descriptionKey: 'admin_content.hero_variant_split_note',
        headerOnDark: true,
    },
    {
        id: 'tint',
        labelKey: 'admin_content.hero_variant_tint',
        descriptionKey: 'admin_content.hero_variant_tint_note',
        headerOnDark: false,
    },
]

const HERO_VARIANT_IDS = HERO_VARIANTS.map((variant) => variant.id)

/** Anything unknown — a removed design, a typo in the CMS — falls back to the
 *  default rather than rendering an unthemed hero. */
export const resolveHeroVariant = (value) =>
    HERO_VARIANT_IDS.includes(value) ? value : DEFAULT_HERO_VARIANT

export const getHeroVariant = (value) => {
    const id = resolveHeroVariant(value)
    return HERO_VARIANTS.find((variant) => variant.id === id)
}
