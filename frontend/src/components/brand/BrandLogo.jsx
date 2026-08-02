import { cn } from '../../utils/helpers'

export const NNMC_LOGO_SRC = '/brand/nnmc-logo.png'

export function BrandMark({
  className,
  alt = 'Национальный научный медицинский центр',
  eager = false,
}) {
  return (
    <img
      src={NNMC_LOGO_SRC}
      alt={alt}
      width="136"
      height="140"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}

export function BrandLockup({
  className,
  markClassName,
  wordmarkClassName,
  subtitleClassName,
  subtitle = 'Телемедицина',
  eager = false,
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-3', className)}>
      <BrandMark
        alt=""
        eager={eager}
        className={cn('h-12 w-[47px]', markClassName)}
      />
      <span className="min-w-0 leading-tight">
        <span className={cn('block font-bold text-slate-900', wordmarkClassName)}>
          MedConnect
        </span>
        {subtitle && (
          <span className={cn('mt-1 block text-xs text-slate-500', subtitleClassName)}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}

