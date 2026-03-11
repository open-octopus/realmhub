import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createInMemoryDatabase } from '../db/database.js'
import { AuthService } from '../services/auth.js'
import { createAuthMiddleware } from './auth.js'
import type Database from 'better-sqlite3'

describe('auth middleware', () => {
  let db: Database.Database
  let authService: AuthService
  let app: express.Express

  beforeEach(() => {
    db = createInMemoryDatabase()
    authService = new AuthService(db)
    const requireAuth = createAuthMiddleware(authService)

    app = express()
    app.use(express.json())
    app.get('/protected', requireAuth('read'), (req, res) => {
      const keyId = (req as unknown as { keyId: number }).keyId
      res.json({ ok: true, keyId })
    })
  })

  afterEach(() => {
    db.close()
  })

  it('should return 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Missing Authorization header')
  })

  it('should return 401 for malformed Authorization header (Token instead of Bearer)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Token xyz')
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Invalid Authorization header format')
  })

  it('should return 401 for Bearer token without rh_live_ prefix', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer some_other_key')
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Invalid Authorization header format')
  })

  it('should return 403 for valid format key that does not exist', async () => {
    const fakeKey = 'rh_live_' + 'a'.repeat(64)
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${fakeKey}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('Invalid or insufficient API key')
  })

  it('should return 403 for valid key with insufficient scope', async () => {
    const { key } = authService.createKey('write')
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${key}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('Invalid or insufficient API key')
  })

  it('should call next and attach keyId for valid key with correct scope', async () => {
    const { key, id } = authService.createKey('read')
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${key}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, keyId: id })
  })
})
