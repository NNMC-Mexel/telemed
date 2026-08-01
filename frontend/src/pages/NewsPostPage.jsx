import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import SEOHead from '../components/seo/SEOHead'
import NewsArticle from '../components/news/NewsArticle'
import { useNewsPost } from '../components/news/useNewsPost'
import { getMediaUrl } from '../services/api'

/**
 * Standalone article page — what a shared link, a search engine or a refresh
 * lands on. Same body as the modal, wrapped in page furniture and real SEO.
 */
export default function NewsPostPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const { post, isLoading, error } = useNewsPost(slug)

  const coverUrl = post?.cover ? getMediaUrl(post.cover.formats?.large || post.cover.url) : undefined
  const absoluteCover = coverUrl?.startsWith('http') ? coverUrl : undefined

  const structuredData = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: post.title,
        description: post.excerpt || undefined,
        datePublished: post.publishAt || undefined,
        image: absoluteCover ? [absoluteCover] : undefined,
        publisher: {
          '@type': 'MedicalOrganization',
          name: 'MedConnect — ННМЦ Телемедицина',
          url: 'https://medconnect.nnmc.kz',
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://medconnect.nnmc.kz/news/${slug}`,
        },
      }
    : null

  return (
    <div className='bg-slate-50 py-10 sm:py-14'>
      <SEOHead
        title={post?.title}
        description={post?.excerpt || undefined}
        url={`/news/${slug}`}
        type='article'
        image={absoluteCover}
        // An article that failed to load must not be indexed as a thin page.
        noindex={Boolean(error) || (!isLoading && !post)}
        structuredData={structuredData}
      />

      <div className='mx-auto max-w-3xl px-4 sm:px-6'>
        <Link
          to='/#news'
          className='mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-teal-700'>
          <ChevronLeft className='h-4 w-4' />
          {t('news.back_to_news')}
        </Link>

        <div className='overflow-hidden rounded-3xl border border-slate-200/80 bg-white elevate-md'>
          <NewsArticle post={post} isLoading={isLoading} error={error} />
        </div>
      </div>
    </div>
  )
}
