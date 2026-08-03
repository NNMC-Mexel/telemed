import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { HERO_VARIANTS, resolveHeroVariant } from '../../config/heroVariants'
import { cn } from '../../utils/helpers'

/**
 * Design picker for the landing hero.
 *
 * Each thumbnail is the real thing in miniature: it carries `.hero-clinical`
 * and `data-hero-variant`, so the backdrop, the scrim and the card surface are
 * painted by the same stylesheet the landing uses. A preview therefore cannot
 * drift from what a visitor sees, and a new design shows up here the moment it
 * is added to `heroVariants.js`.
 */
function HeroVariantPicker({ value, onChange }) {
    const { t } = useTranslation()
    const selected = resolveHeroVariant(value)

    return (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {HERO_VARIANTS.map((variant) => {
                const isSelected = variant.id === selected

                return (
                    <button
                        key={variant.id}
                        type='button'
                        aria-pressed={isSelected}
                        onClick={() => onChange(variant.id)}
                        className={cn(
                            'group rounded-2xl border-2 p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                            isSelected
                                ? 'border-teal-600 bg-teal-50/60'
                                : 'border-slate-200 hover:border-teal-300',
                        )}>
                        <div
                            data-hero-variant={variant.id}
                            className='hero-clinical relative aspect-[16/9] overflow-hidden rounded-xl'>
                            <img
                                src='/nnmc-campus-hero-poster-828.jpg'
                                alt=''
                                aria-hidden='true'
                                loading='lazy'
                                className='hero-clinical__background-media absolute inset-0 h-full w-full object-cover'
                            />
                            <div className='hero-clinical__background-scrim absolute inset-0' />

                            {/* A miniature of the real composition: badge, two
                                headline lines, a button and the service card.
                                Heights are fixed rather than percentages — the
                                text column is auto-height, so percentages there
                                would collapse to nothing. */}
                            <div className='relative flex h-full items-center gap-3 p-4'>
                                <div className='flex-1'>
                                    <span className='hero-clinical__chip block h-2.5 w-[64%] rounded-full border' />
                                    <div className='hero-clinical__title mt-2 h-3 w-[86%] rounded-sm bg-current' />
                                    <div className='hero-clinical__accent mt-1 h-3 w-[52%] rounded-sm bg-current' />
                                    <div className='hero-clinical__lead mt-2 h-1.5 w-[78%] rounded-sm bg-current opacity-70' />
                                    <div className='hero-clinical__primary-cta mt-2.5 h-5 w-[46%] rounded-md' />
                                </div>
                                <div className='hero-clinical__service-card flex w-[42%] flex-col gap-1.5 rounded-xl border p-2.5'>
                                    <div className='h-2 w-[70%] rounded-sm bg-slate-900/70' />
                                    <div className='h-5 w-full rounded-sm bg-slate-900/10' />
                                    <div className='h-5 w-full rounded-sm bg-slate-900/10' />
                                    <div className='h-5 w-full rounded-sm bg-slate-900/10' />
                                </div>
                            </div>
                        </div>

                        <div className='flex items-start gap-2 px-2 pb-1 pt-3'>
                            <span
                                className={cn(
                                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                    isSelected
                                        ? 'border-teal-600 bg-teal-600 text-white'
                                        : 'border-slate-300 group-hover:border-teal-400',
                                )}>
                                {isSelected && <Check className='h-3 w-3' strokeWidth={3} />}
                            </span>
                            <span className='min-w-0'>
                                <span className='block text-sm font-semibold text-slate-900'>
                                    {t(variant.labelKey)}
                                </span>
                                <span className='mt-0.5 block text-xs leading-relaxed text-slate-500'>
                                    {t(variant.descriptionKey)}
                                </span>
                            </span>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

export default HeroVariantPicker
