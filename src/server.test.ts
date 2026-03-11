import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, type AppContext } from './server.js'

describe('Server', () => {
  let ctx: AppContext

  afterEach(() => {
    ctx?.close()
  })

  it('should create app', () => {
    ctx = createTestApp()
    expect(ctx.app).toBeDefined()
    expect(ctx.db).toBeDefined()
    expect(ctx.registry).toBeDefined()
    expect(ctx.close).toBeInstanceOf(Function)
  })

  it('should respond to healthz', async () => {
    ctx = createTestApp()
    const res = await request(ctx.app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.version).toBe('2025.1.0')
    expect(typeof res.body.uptime).toBe('number')
  })

  it('should return 404 for unknown API routes', async () => {
    ctx = createTestApp()
    const res = await request(ctx.app).get('/api/nonexistent')
    expect(res.status).toBe(404)
  })

  it('should return browse page at root', async () => {
    ctx = createTestApp()
    const res = await request(ctx.app).get('/').set('Accept', 'text/html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('RealmHub')
  })

  it('should list packages via API', async () => {
    ctx = createTestApp()
    const res = await request(ctx.app).get('/api/packages')
    expect(res.status).toBe(200)
    expect(res.body.packages).toEqual([])
    expect(res.body.total).toBe(0)
  })
})
