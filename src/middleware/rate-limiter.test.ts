import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createRateLimiter } from './rate-limiter.js'

function createApp(options?: Parameters<typeof createRateLimiter>[0]) {
  const app = express()
  app.use(createRateLimiter(options))
  app.get('/test', (_req, res) => {
    res.status(200).json({ ok: true })
  })
  return app
}

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should allow requests within the limit', async () => {
    const app = createApp({ maxRequests: 3, windowMs: 60_000 })

    const res = await request(app).get('/test')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('should reject requests over the limit with 429', async () => {
    const app = createApp({ maxRequests: 2, windowMs: 60_000 })

    await request(app).get('/test')
    await request(app).get('/test')
    const res = await request(app).get('/test')

    expect(res.status).toBe(429)
    expect(res.body.error).toContain('Too many requests')
    expect(res.body.status).toBe(429)
    expect(res.body.retryAfter).toBeGreaterThan(0)
  })

  it('should set X-RateLimit-* headers', async () => {
    const app = createApp({ maxRequests: 5, windowMs: 60_000 })

    const res = await request(app).get('/test')

    expect(res.headers['x-ratelimit-limit']).toBe('5')
    expect(res.headers['x-ratelimit-remaining']).toBe('4')
    expect(res.headers['x-ratelimit-reset']).toBeDefined()

    // After a second request, remaining should decrease
    const res2 = await request(app).get('/test')
    expect(res2.headers['x-ratelimit-remaining']).toBe('3')
  })

  it('should reset counter after window expires', async () => {
    const app = createApp({ maxRequests: 1, windowMs: 10_000 })

    // First request passes
    const res1 = await request(app).get('/test')
    expect(res1.status).toBe(200)

    // Second request is rate-limited
    const res2 = await request(app).get('/test')
    expect(res2.status).toBe(429)

    // Advance time past the window
    vi.advanceTimersByTime(11_000)

    // Request should pass again after window reset
    const res3 = await request(app).get('/test')
    expect(res3.status).toBe(200)
  })

  it('should count different IPs independently', async () => {
    const app = express()
    app.set('trust proxy', true)
    app.use(createRateLimiter({ maxRequests: 1, windowMs: 60_000 }))
    app.get('/test', (_req, res) => {
      res.status(200).json({ ok: true })
    })

    // First IP uses its one allowed request
    const res1 = await request(app).get('/test').set('X-Forwarded-For', '1.2.3.4')
    expect(res1.status).toBe(200)

    // First IP is now rate-limited
    const res2 = await request(app).get('/test').set('X-Forwarded-For', '1.2.3.4')
    expect(res2.status).toBe(429)

    // Second IP should still be allowed
    const res3 = await request(app).get('/test').set('X-Forwarded-For', '5.6.7.8')
    expect(res3.status).toBe(200)
  })
})
