import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Volume2, VolumeX, X } from 'lucide-react'
import { getMediaUrl } from '../../services/api'
import { cn } from '../../utils/helpers'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Full-screen story player.
 *
 * Rendered in a portal: the landing wraps its sections in transformed, reveal
 * animated containers, and a `position: fixed` overlay inside one of those
 * would be positioned against the ancestor instead of the viewport.
 */
export default function StoriesViewer({ stories, startIndex = 0, onClose, onSeen }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(startIndex)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  const videoRef = useRef(null)
  const frameRef = useRef(0)
  const startedAtRef = useRef(0)
  const elapsedRef = useRef(0)
  const touchStartRef = useRef(null)

  const story = stories[index]
  // Auto-advance is motion the user did not ask for; under a reduced-motion
  // preference the reel becomes manual and the progress bar stays filled.
  const autoAdvance = useMemo(() => !prefersReducedMotion(), [])

  const goTo = useCallback(
    (next) => {
      if (next < 0) return
      if (next >= stories.length) {
        onClose()
        return
      }
      elapsedRef.current = 0
      setProgress(0)
      setIndex(next)
    },
    [stories.length, onClose],
  )

  const goNext = useCallback(() => goTo(index + 1), [goTo, index])
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index])

  // Mark as seen as soon as a slide is shown, not when it finishes — opening
  // it is the signal that matters for dimming the ring.
  useEffect(() => {
    if (story) onSeen?.(story.id)
  }, [story, onSeen])

  // --- Progress -------------------------------------------------------------
  useEffect(() => {
    // Under reduced motion nothing advances on its own, so there is no timer
    // to run — the bar is filled by `displayProgress` below instead.
    if (!story || !autoAdvance) return undefined

    const durationMs = story.isVideo
      ? (videoRef.current?.duration || story.durationSeconds || 8) * 1000
      : (story.durationSeconds || 8) * 1000

    startedAtRef.current = performance.now() - elapsedRef.current

    const tick = (now) => {
      if (isPaused) {
        startedAtRef.current = now - elapsedRef.current
        frameRef.current = requestAnimationFrame(tick)
        return
      }

      elapsedRef.current = now - startedAtRef.current
      const ratio = Math.min(elapsedRef.current / durationMs, 1)
      setProgress(ratio)

      if (ratio >= 1) {
        goNext()
        return
      }
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [story, index, isPaused, autoAdvance, goNext])

  // --- Video playback -------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
    if (isPaused) video.pause()
    else video.play().catch(() => {})
  }, [isPaused, isMuted, index])

  // --- Keyboard, scroll lock ------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight') goNext()
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === ' ') {
        event.preventDefault()
        setIsPaused((p) => !p)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [goNext, goPrev, onClose])

  if (!story) return null

  // With auto-advance off the current segment reads as complete rather than
  // sitting at zero forever.
  const displayProgress = autoAdvance ? progress : 1

  const mediaUrl = getMediaUrl(story.media?.url)
  const posterUrl = story.poster ? getMediaUrl(story.poster.formats?.medium || story.poster.url) : undefined

  const onTouchStart = (event) => {
    touchStartRef.current = event.touches[0].clientX
    setIsPaused(true)
  }

  const onTouchEnd = (event) => {
    setIsPaused(false)
    const start = touchStartRef.current
    touchStartRef.current = null
    if (start === null) return
    const delta = start - event.changedTouches[0].clientX
    if (Math.abs(delta) < 50) return
    if (delta > 0) goNext()
    else goPrev()
  }

  return createPortal(
    <div
      className='fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/95 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-label={t('stories.viewer_label')}>
      <button
        type='button'
        onClick={onClose}
        aria-label={t('common.close')}
        className='absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20'>
        <X className='h-5 w-5' />
      </button>

      <div
        className='relative flex h-full w-full max-w-[460px] flex-col sm:h-[92vh] sm:rounded-3xl sm:overflow-hidden'
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}>
        {/* Progress segments */}
        <div className='absolute inset-x-0 top-0 z-20 flex gap-1.5 p-3'>
          {stories.map((item, i) => (
            <div key={item.id} className='h-1 flex-1 overflow-hidden rounded-full bg-white/25'>
              <div
                className='h-full rounded-full bg-white'
                style={{ width: `${i < index ? 100 : i === index ? displayProgress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* Media */}
        <div className='relative flex-1 overflow-hidden bg-black'>
          {/* Blurred fill behind the media. Editors will not always upload a
              true 9:16 asset, and letterboxing a landscape clip against flat
              black reads as broken rather than deliberate. */}
          {posterUrl && (
            <img
              src={posterUrl}
              alt=''
              aria-hidden='true'
              className='absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl'
            />
          )}

          {story.isVideo ? (
            <video
              ref={videoRef}
              key={story.id}
              src={mediaUrl}
              poster={posterUrl}
              autoPlay
              muted={isMuted}
              playsInline
              preload='auto'
              controls={!autoAdvance}
              className='relative h-full w-full object-contain'
            />
          ) : (
            <img
              src={mediaUrl}
              alt={story.media?.alternativeText || story.title}
              className='relative h-full w-full object-contain'
            />
          )}

          {/* Tap zones. Kept below the chrome so buttons stay clickable. */}
          <button
            type='button'
            aria-label={t('stories.previous')}
            onClick={goPrev}
            className='absolute inset-y-0 left-0 z-10 w-1/3 cursor-default focus:outline-none'
          />
          <button
            type='button'
            aria-label={t('stories.next')}
            onClick={goNext}
            className='absolute inset-y-0 right-0 z-10 w-2/3 cursor-default focus:outline-none'
          />

          {isPaused && (
            <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center'>
              <Pause className='h-14 w-14 text-white/80' />
            </div>
          )}
        </div>

        {/* Caption and call to action */}
        <div className='pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink-950/90 via-ink-950/50 to-transparent px-5 pb-7 pt-16'>
          <h3 className='text-lg font-semibold leading-snug text-white'>{story.title}</h3>
          {story.linkUrl && (
            <div className='pointer-events-auto mt-4'>
              {story.linkUrl.startsWith('/') ? (
                <Link
                  to={story.linkUrl}
                  onClick={onClose}
                  className='inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink-900 transition-transform hover:-translate-y-0.5'>
                  {story.linkLabel || t('stories.open')}
                  <ArrowUpRight className='h-4 w-4' />
                </Link>
              ) : (
                <a
                  href={story.linkUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink-900 transition-transform hover:-translate-y-0.5'>
                  {story.linkLabel || t('stories.open')}
                  <ArrowUpRight className='h-4 w-4' />
                </a>
              )}
            </div>
          )}
        </div>

        {story.isVideo && (
          <button
            type='button'
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? t('stories.unmute') : t('stories.mute')}
            className='absolute right-3 top-12 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20'>
            {isMuted ? <VolumeX className='h-5 w-5' /> : <Volume2 className='h-5 w-5' />}
          </button>
        )}
      </div>

      {/* Desktop arrows, outside the frame so they never cover the media. */}
      <button
        type='button'
        onClick={goPrev}
        aria-label={t('stories.previous')}
        className={cn(
          'absolute left-6 z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 lg:flex',
          index === 0 && 'pointer-events-none opacity-30',
        )}>
        <ChevronLeft className='h-6 w-6' />
      </button>
      <button
        type='button'
        onClick={goNext}
        aria-label={t('stories.next')}
        className='absolute right-6 z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 lg:flex'>
        <ChevronRight className='h-6 w-6' />
      </button>
    </div>,
    document.body,
  )
}
