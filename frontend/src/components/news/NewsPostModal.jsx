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
  const scrollRef = useRef(null)
  const previousFocusRef = useRef(null)
  const close = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }

      if (event.key === 'Tab') {
        const focusable = [...(panelRef.current?.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) || [])]
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    previousFocusRef.current = document.activeElement
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog so the article is reachable by keyboard and
    // screen readers announce it instead of the page underneath.
    const focusFrame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 })
      panelRef.current?.querySelector('[data-modal-autofocus="true"]')?.focus()
    })

    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus?.()
    }
  }, [close])

  return (
    <div
      className='safe-modal-viewport fixed inset-0 z-[70] flex items-center justify-center overflow-hidden overscroll-contain bg-ink-950/70 backdrop-blur-sm'
      onClick={close}>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={post?.title || t('news.dialog_label')}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className='safe-modal-panel animate-scaleIn relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-ink-950/30 outline-none'>
        <button
          type='button'
          onClick={close}
          data-modal-autofocus='true'
          aria-label={t('common.close')}
          className='absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-ink-950/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-ink-950/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 active:scale-95 sm:right-4 sm:top-4'>
          <X className='h-5 w-5' />
        </button>

        <div
          ref={scrollRef}
          data-testid='news-modal-scroll'
          className='min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          <NewsArticle post={post} isLoading={isLoading} error={error} compactMobile />
        </div>
      </div>
    </div>
  )
}
