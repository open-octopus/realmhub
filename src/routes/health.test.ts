import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createHealthRoutes } from './health.js'

describe('health routes', () => {
  const app = express()
  app.use(createHealthRoutes())

  it('GET /healthz returns 200 with status ok', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('response includes version string', async () => {
    const res = await request(app).get('/healthz')
    expect(res.body.version).toBe('2025.1.0')
  })

  it('response includes numeric uptime', async () => {
    const res = await request(app).get('/healthz')
    expect(typeof res.body.uptime).toBe('number')
    expect(res.body.uptime).toBeGreaterThan(0)
  })
})
