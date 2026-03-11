import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createInMemoryDatabase } from '../db/database.js'
import { AuthService } from '../services/auth.js'
import { createAuthMiddleware } from '../middleware/auth.js'
import { createAuthRoutes } from './auth.js'
import { errorHandler } from '../middleware/error-handler.js'
import type Database from 'better-sqlite3'

describe('auth routes', () => {
  let db: Database.Database
  let authService: AuthService
  let app: express.Express
  let adminKey: string

  beforeEach(() => {
    db = createInMemoryDatabase()
    authService = new AuthService(db)
    const requireAuth = createAuthMiddleware(authService)

    app = express()
    app.use(express.json())
    app.use('/api/keys', createAuthRoutes(authService, requireAuth))
    app.use(errorHandler)

    // Create an admin key for authenticated requests
    const result = authService.createKey('admin')
    adminKey = result.key
  })

  afterEach(() => {
    db.close()
  })

  describe('POST /api/keys', () => {
    it('should return 401 when no auth is provided', async () => {
      const res = await request(app)
        .post('/api/keys')
        .send({ scope: 'read' })
      expect(res.status).toBe(401)
    })

    it('should return 403 when using a non-admin key', async () => {
      const { key } = authService.createKey('read')
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${key}`)
        .send({ scope: 'read' })
      expect(res.status).toBe(403)
    })

    it('should return 400 when scope param is missing', async () => {
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${adminKey}`)
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Missing scope')
    })

    it('should return 201 with key and id for admin key with valid body', async () => {
      const res = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${adminKey}`)
        .send({ scope: 'read', description: 'test key' })
      expect(res.status).toBe(201)
      expect(res.body.key).toMatch(/^rh_live_/)
      expect(typeof res.body.id).toBe('number')
    })
  })

  describe('DELETE /api/keys/:id', () => {
    it('should return 401 when no auth is provided', async () => {
      const res = await request(app).delete('/api/keys/1')
      expect(res.status).toBe(401)
    })

    it('should return success: true when admin revokes a valid key', async () => {
      const { id } = authService.createKey('read')
      const res = await request(app)
        .delete(`/api/keys/${id}`)
        .set('Authorization', `Bearer ${adminKey}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true })
    })

    it('should return 400 for invalid (non-numeric) key id', async () => {
      const res = await request(app)
        .delete('/api/keys/abc')
        .set('Authorization', `Bearer ${adminKey}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid key ID')
    })
  })
})
