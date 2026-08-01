import { useEffect, useState } from 'react'
import { newsAPI, normalizeResponse } from '../../services/api'

/**
 * Loads one published article by slug.
 *
 * Both the modal and the standalone page use this, so an expired or
 * unpublished post is a 404 in either entry point — the server decides
 * visibility, never the client.
 */
export function useNewsPost(slug) {
  // The resolved slug is stored alongside the payload so "still loading" is
  // derived rather than reset synchronously inside the effect.
  const [resolved, setResolved] = useState({ slug: null, post: null, error: null })

  useEffect(() => {
    if (!slug) return undefined

    let cancelled = false

    newsAPI
      .getBySlug(slug)
      .then((res) => {
        if (!cancelled) setResolved({ slug, post: normalizeResponse(res)?.data || null, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Error loading news post:', err)
        setResolved({ slug, post: null, error: err })
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const isLoading = resolved.slug !== slug

  return {
    post: isLoading ? null : resolved.post,
    isLoading,
    error: isLoading ? null : resolved.error,
  }
}
