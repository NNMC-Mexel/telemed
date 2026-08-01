import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import { getMediaUrl } from '../../services/api'
import { cn } from '../../utils/helpers'
import StoriesViewer from './StoriesViewer'

const SEEN_KEY = 'nnmc.stories.seen'

// Which stories the visitor has already opened, so the ring can dim. Kept in
// localStorage rather than on the account: the reel is public and the state is
// a convenience, not data worth storing about a person.
function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export default function StoriesRow({ stories }) {
  const { t } = useTranslation()
  // Read once during the initial render — this is a client-rendered SPA, so
  // there is no server markup for storage access to disagree with.
  const [seen, setSeen] = useState(readSeen)
  const [openAt, setOpenAt] = useState(null)

  const markSeen = useCallback((id) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev).add(id)
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next]))
      } catch {
        // Private mode or a full quota — dimming is cosmetic, so ignore.
      }
      return next
    })
  }, [])

  if (!stories || stories.length === 0) return null

  return (
    <div data-reveal className='mb-12'>
      <p className='mb-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500'>
        {t('stories.label')}
      </p>

      {/* Horizontal reel: scrolls on narrow screens, wraps on wide ones. */}
      <ul className='-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0'>
        {stories.map((story, index) => {
          const poster = story.poster
            ? getMediaUrl(story.poster.formats?.small || story.poster.url)
            : null
          const isSeen = seen.has(story.id)

          return (
            <li key={story.id} className='w-20 shrink-0 snap-start sm:w-24'>
              <button
                type='button'
                onClick={() => setOpenAt(index)}
                className='group flex w-full flex-col items-center gap-2 text-center focus:outline-none'>
                <span
                  className={cn(
                    'relative flex h-20 w-20 items-center justify-center rounded-full p-[3px] transition-transform duration-300 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-teal-600 group-focus-visible:ring-offset-2 sm:h-24 sm:w-24',
                    // An unseen story gets the brand ring; once opened it drops
                    // to a neutral one, the convention people already know.
                    isSeen
                      ? 'bg-slate-300'
                      : 'bg-gradient-to-br from-teal-600 via-sky-500 to-sand-400',
                  )}>
                  <span className='flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100'>
                    {poster ? (
                      <img
                        src={poster}
                        alt=''
                        loading='lazy'
                        decoding='async'
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <Play className='h-6 w-6 text-slate-400' />
                    )}
                  </span>
                  {story.isVideo && (
                    <span className='absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-ink-900 text-white'>
                      <Play className='h-3 w-3 fill-current' />
                    </span>
                  )}
                </span>
                <span className='line-clamp-2 text-xs font-medium leading-snug text-slate-700'>
                  {story.title}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {openAt !== null && (
        <StoriesViewer
          stories={stories}
          startIndex={openAt}
          onSeen={markSeen}
          onClose={() => setOpenAt(null)}
        />
      )}
    </div>
  )
}
