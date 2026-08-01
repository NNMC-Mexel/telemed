import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, CalendarDays, Loader2 } from 'lucide-react'
import { getMediaUrl } from '../../services/api'
import { cn, formatDate } from '../../utils/helpers'
import NewsKindBadge from './NewsKindBadge'

/**
 * The article itself — cover or video, meta, lead, body, call to action.
 *
 * Shared verbatim by the routed modal and the standalone page so a link opened
 * in a new tab reads identically to one opened from the landing.
 */
export default function NewsArticle({ post, isLoading, error, className, compactMobile = false }) {
  const { t, i18n } = useTranslation()

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-24'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className='px-6 py-20 text-center'>
        <p className='text-lg font-semibold text-slate-900'>{t('news.not_found_title')}</p>
        <p className='mt-2 text-slate-600'>{t('news.not_found_text')}</p>
        <Link
          to='/'
          className='mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-teal-800'>
          {t('news.back_home')}
        </Link>
      </div>
    )
  }

  const cover = post.cover ? getMediaUrl(post.cover.formats?.large || post.cover.url) : null
  const video = post.video ? getMediaUrl(post.video.url) : null
  const published = post.publishAt ? formatDate(post.publishAt, i18n.language) : null

  return (
    <article className={cn('bg-white', className)}>
      {/* Video wins over the cover: if an editor attached one it is the point
          of the article, not decoration. */}
      {video ? (
        <video
          src={video}
          poster={cover || undefined}
          controls
          playsInline
          preload='metadata'
          className={cn(
            'w-full bg-slate-950 object-cover',
            compactMobile ? 'aspect-2/1 sm:aspect-video' : 'aspect-video',
          )}
        />
      ) : (
        cover && (
          <img
            src={cover}
            alt={post.cover.alternativeText || post.title}
            className={cn(
              'w-full object-cover',
              compactMobile ? 'aspect-2/1 sm:aspect-video' : 'aspect-video',
            )}
          />
        )
      )}

      <div className={compactMobile ? 'px-5 py-6 sm:px-10 sm:py-10' : 'px-6 py-8 sm:px-10 sm:py-10'}>
        <div className='flex flex-wrap items-center gap-3'>
          <NewsKindBadge post={post} />
          {published && (
            <span className='inline-flex items-center gap-1.5 text-sm text-slate-500'>
              <CalendarDays className='h-4 w-4' />
              {published}
            </span>
          )}
        </div>

        <h1 className='mt-5 text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-950 sm:text-3xl'>
          {post.title}
        </h1>

        {post.excerpt && (
          <p className='mt-4 text-lg leading-relaxed text-slate-600'>{post.excerpt}</p>
        )}

        {post.body && (
          // Body is plain text from the CMS richtext field; paragraphs are split
          // on blank lines rather than injected as HTML.
          <div className='mt-6 space-y-4'>
            {String(post.body)
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p key={index} className='leading-relaxed text-slate-700'>
                  {paragraph.trim()}
                </p>
              ))}
          </div>
        )}

        {post.linkUrl && (
          <div className={compactMobile ? 'mt-6 sm:mt-8' : 'mt-8'}>
            {post.linkUrl.startsWith('/') ? (
              <Link
                to={post.linkUrl}
                className='group inline-flex items-center gap-2 rounded-2xl bg-teal-700 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-teal-800'>
                {post.linkLabel || t('news.read_more')}
                <ArrowUpRight className='h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5' />
              </Link>
            ) : (
              <a
                href={post.linkUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='group inline-flex items-center gap-2 rounded-2xl bg-teal-700 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-teal-800'>
                {post.linkLabel || t('news.read_more')}
                <ArrowUpRight className='h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5' />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
