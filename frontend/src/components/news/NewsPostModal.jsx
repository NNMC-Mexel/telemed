import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import NewsArticle from './NewsArticle'
import { useNewsPost } from './useNewsPost'

/**
 * The article rendered over the page it was opened from.
 *
 * Closing pops history rather than pushing, so the browser Back button and the
 * close button do the same thing and the landing keeps its scroll position.
 */
export default function NewsPostModal() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { post, isLoading, error } = useNewsPost(slug)

  const panelRef = useRef(null)
  const close = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog so the article is reachable by keyboard and
    // screen readers announce it instead of the page underneath.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [close])

  return (
    <div
      className='fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink-950/70 p-0 backdrop-blur-sm sm:p-6'
      onClick={close}>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={post?.title || t('news.dialog_label')}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className='animate-scaleIn relative my-0 w-full max-w-3xl overflow-hidden bg-white shadow-2xl outline-none sm:my-6 sm:rounded-3xl'>
        <button
          type='button'
          onClick={close}
          aria-label={t('common.close')}
          className='absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink-950/45 text-white backdrop-blur-sm transition-colors hover:bg-ink-950/70'>
          <X className='h-5 w-5' />
        </button>

        <NewsArticle post={post} isLoading={isLoading} error={error} />
      </div>
    </div>
  )
}
