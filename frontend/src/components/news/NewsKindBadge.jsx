import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import { getNewsKindStyle } from './newsKind'

/** Colour-coded pill naming the kind of post — promo, news, event, announcement. */
export default function NewsKindBadge({ post, className }) {
  const { t } = useTranslation()
  const { Icon, badge } = getNewsKindStyle(post.kind)
  const label = post.badgeLabel || t(`landing.news.kind_${post.kind}`, t('landing.news.kind_news'))

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]',
        badge,
        className,
      )}>
      <Icon className='h-3.5 w-3.5' />
      {label}
    </span>
  )
}
