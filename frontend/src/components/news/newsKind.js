import { CalendarDays, Megaphone, Newspaper, Percent } from 'lucide-react'

/**
 * Four kinds drawn from the three brandbook colours plus a neutral, so the
 * taxonomy stays scannable without introducing hues the brand does not own.
 * Promo gets the warm sand because it is the one that has to catch the eye
 * against an otherwise cool page.
 *
 * Shared by the landing cards and the article view. Kept in a plain module
 * rather than next to the badge component so Fast Refresh keeps working.
 */
export const newsKindStyles = {
  promo: {
    Icon: Percent,
    badge: 'bg-sand-50 text-sand-700 border-sand-200',
    gradient: 'from-sand-500 via-sand-700 to-ink-900',
  },
  news: {
    Icon: Newspaper,
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    gradient: 'from-teal-600 via-teal-800 to-ink-950',
  },
  event: {
    Icon: CalendarDays,
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    gradient: 'from-sky-600 via-sky-800 to-ink-900',
  },
  announcement: {
    Icon: Megaphone,
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    gradient: 'from-slate-500 via-slate-700 to-ink-900',
  },
}

export const getNewsKindStyle = (kind) => newsKindStyles[kind] || newsKindStyles.news
