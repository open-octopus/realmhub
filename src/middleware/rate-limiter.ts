import type { RequestHandler } from 'express'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimiterOptions {
  windowMs?: number
  maxRequests?: number
}

export function createRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const windowMs = options.windowMs ?? 60_000 // 1 minute
  const maxRequests = options.maxRequests ?? 100

  const store = new Map<string, RateLimitEntry>()

  // Cleanup old entries every window period
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key)
      }
    }
  }, windowMs)

  // Allow the timer to not block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }

  return (req, res, next) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()

    let entry = store.get(ip)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      store.set(ip, entry)
    }

    entry.count++

    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count))
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000))

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests, please try again later',
        status: 429,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      })
      return
    }

    next()
  }
}
