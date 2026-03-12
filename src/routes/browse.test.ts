import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { createInMemoryDatabase } from '../db/database.js'
import { PackageStore } from '../storage/package-store.js'
import { Registry } from '../services/registry.js'
import { createBrowseRoutes } from '../web/browse.js'
import type { RealmPackage } from '../schema/package-schema.js'
import type Database from 'better-sqlite3'

function makeManifest(overrides: Partial<RealmPackage> = {}): RealmPackage {
  return {
    name: 'test-pkg',
    version: '2025.1.1',
    description: 'A test package',
    author: 'tester',
    realm: 'test',
    skills: [],
    dependencies: {},
    engine: '>=22',
    ...overrides,
  }
}

describe('browse routes', () => {
  let tmpDir: string
  let db: Database.Database
  let app: express.Express
  let registry: Registry

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'realmhub-browse-test-'))
    db = createInMemoryDatabase()
    const store = new PackageStore(tmpDir)
    registry = new Registry(db, store)

    app = express()
    app.use(createBrowseRoutes(registry))
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('GET / with Accept: text/html returns 200 with HTML containing RealmHub', async () => {
    const res = await request(app).get('/').set('Accept', 'text/html')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('html')
    expect(res.text).toContain('RealmHub')
  })

  it('GET / with Accept: application/json falls through (no handler, 404)', async () => {
    const res = await request(app)
      .get('/')
      .set('Accept', 'application/json')
    expect(res.status).toBe(404)
  })

  it('GET / with published packages renders HTML containing package names', async () => {
    await registry.publish(makeManifest({ name: 'alpha-realm' }), Buffer.from('a'))
    await registry.publish(makeManifest({ name: 'beta-realm' }), Buffer.from('b'))

    const res = await request(app).get('/').set('Accept', 'text/html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('alpha-realm')
    expect(res.text).toContain('beta-realm')
  })

  it('GET /packages/:name for existing package returns 200 with HTML', async () => {
    await registry.publish(makeManifest({ name: 'my-realm' }), Buffer.from('data'))

    const res = await request(app).get('/packages/my-realm')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('html')
    expect(res.text).toContain('my-realm')
  })

  it('GET /packages/:name for non-existent package returns 404 with Not Found HTML', async () => {
    const res = await request(app).get('/packages/no-such-pkg')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('html')
    expect(res.text).toContain('Not Found')
  })
})
