import { useEffect } from 'react'

// Elements reveal once their top edge crosses this fraction of the viewport,
// matching the observer's bottom rootMargin.
const TRIGGER_RATIO = 0.9

/**
 * Reveals every `[data-reveal]` element on the page as it scrolls into view.
 *
 * A single observer serves the whole page and each element is unobserved once
 * revealed, so this stays cheap on long marketing pages. Pass `deps` when
 * content arrives asynchronously (e.g. doctors loaded from the API) so the
 * newly mounted nodes get picked up.
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]:not(.is-visible)')
    if (nodes.length === 0) return

    // Users who opted out of motion get the final state immediately.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }

    const pending = new Set(nodes)

    const reveal = (node) => {
      node.classList.add('is-visible')
      pending.delete(node)
      observer.unobserve(node)
    }

    // A fast scroll — a wheel flick, a scrollbar drag, an anchor jump — can move
    // an element from below the fold to above it between two observer samples,
    // so it never reports as intersecting and would stay at opacity 0 forever.
    // Sweeping everything already past the trigger line closes that gap.
    const sweep = () => {
      const line = window.innerHeight * TRIGGER_RATIO
      pending.forEach((node) => {
        if (node.getBoundingClientRect().top < line) reveal(node)
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target)
        })
        sweep()
      },
      { rootMargin: `0px 0px -${(1 - TRIGGER_RATIO) * 100}% 0px`, threshold: 0 },
    )

    pending.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default useReveal
