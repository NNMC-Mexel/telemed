/**
 * Simple in-memory rate limiter middleware for sensitive auth endpoints.
 * Applied to: /api/auth/local (login), /api/auth/local/register, /api/auth/forgot-password
 *
 * Limits: 10 requests per IP per 15-minute window.
 * Resets on server restart (acceptable for test; use Redis for production).
 *
 * Set RATE_LIMIT_ENABLED=false in .env to disable in dev/QA environments.
 */

const ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false'

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth/local':            { max: 10, windowMs: 15 * 60 * 1000 },
  '/api/auth/local/register':   { max: 5,  windowMs: 60 * 60 * 1000 },
  '/api/auth/forgot-password':  { max: 5,  windowMs: 60 * 60 * 1000 },
}

const store = new Map<string, { count: number; resetAt: number }>()

// Cleanup expired entries every 30 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 30 * 60 * 1000)

export default (config, { strapi }) => {
  return async (ctx, next) => {
    if (!ENABLED) return next()

    const path = ctx.request.path
    const limit = LIMITS[path]

    if (!limit) return next()

    const ip = ctx.request.ip || 'unknown'
    const key = `${ip}:${path}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + limit.windowMs })
      return next()
    }

    if (entry.count >= limit.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      ctx.set('Retry-After', String(retryAfter))
      ctx.status = 429
      ctx.body = { error: { status: 429, name: 'TooManyRequests', message: 'Too many requests. Please try again later.' } }
      return
    }

    entry.count++
    return next()
  }
}
