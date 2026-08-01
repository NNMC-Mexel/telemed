import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const MAX_SAVED_POSITIONS = 100

function findHashTarget(hash) {
  if (!hash) return null

  let targetName = hash.slice(1)
  try {
    targetName = decodeURIComponent(targetName)
  } catch {
    // Keep the raw hash when it contains an invalid escape sequence.
  }

  return document.getElementById(targetName) || document.getElementsByName(targetName)[0] || null
}

function savePosition(positions, key) {
  positions.set(key, { left: window.scrollX, top: window.scrollY })

  if (positions.size > MAX_SAVED_POSITIONS) {
    const oldestKey = positions.keys().next().value
    positions.delete(oldestKey)
  }
}

/**
 * Gives client-side navigation the same scroll semantics as regular pages:
 * new pages start at the top, hashes target their section, and browser history
 * restores the position that belonged to that history entry.
 */
export default function RouteScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positionsRef = useRef(new Map())
  const previousLocationRef = useRef(null)

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined

    const previousMode = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previousMode
    }
  }, [])

  useLayoutEffect(() => {
    const positions = positionsRef.current
    const previousLocation = previousLocationRef.current
    previousLocationRef.current = location

    // Routed news modals intentionally keep the landing page underneath at
    // its current offset. The original position was saved by the prior cleanup.
    if (location.state?.background) return undefined

    const pathnameChanged =
      previousLocation === null || previousLocation.pathname !== location.pathname
    const hashChanged = previousLocation?.hash !== location.hash
    const sameUrlPushed =
      navigationType === 'PUSH' &&
      previousLocation !== null &&
      previousLocation.pathname === location.pathname &&
      previousLocation.search === location.search &&
      previousLocation.hash === location.hash
    const savedPosition =
      navigationType === 'POP' ? positions.get(location.key) : null

    const frameId = window.requestAnimationFrame(() => {
      const hashTarget = findHashTarget(location.hash)

      if (hashTarget) {
        hashTarget.scrollIntoView({ behavior: 'instant', block: 'start' })
        return
      }

      if (savedPosition) {
        window.scrollTo({ ...savedPosition, behavior: 'instant' })
        return
      }

      if (pathnameChanged || hashChanged || sameUrlPushed) {
        window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
      }
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      savePosition(positions, location.key)
    }
  }, [location, navigationType])

  return null
}
