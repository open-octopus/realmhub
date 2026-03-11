import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { createInMemoryDatabase } from '../db/database.js'
import { PackageStore } from '../storage/package-store.js'
import { Registry } from '../services/registry.js'
import { createSearchRoutes } from './search.js'
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

describe('search routes', () => {
  let tmpDir: string
  let db: Database.Database
  let app: express.Express
  let registry: Registry

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'realmhub-search-test-'))
    db = createInMemoryDatabase()
    const store = new PackageStore(tmpDir)
    registry = new Registry(db, store)

    app = express()
    app.use('/api/search', createSearchRoutes(registry))
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should return search results matching name', async () => {
    await registry.publish(makeManifest({ name: 'pet-care', description: 'Manage pets' }), Buffer.from('a'))
    await registry.publish(makeManifest({ name: 'finance', description: 'Track money' }), Buffer.from('b'))

    const res = await request(app).get('/api/search?q=pet')
    expect(res.status).toBe(200)
    expect(res.body.results.length).toBeGreaterThanOrEqual(1)
    expect(res.body.results.some((r: { name: string }) => r.name === 'pet-care')).toBe(true)
  })

  it('should return empty results for no matches', async () => {
    await registry.publish(makeManifest({ name: 'pet-care' }), Buffer.from('a'))

    const res = await request(app).get('/api/search?q=zzzznonexistent')
    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(0)
  })

  it('should return all packages for empty query', async () => {
    await registry.publish(makeManifest({ name: 'pkg-one' }), Buffer.from('a'))
    await registry.publish(makeManifest({ name: 'pkg-two' }), Buffer.from('b'))

    const res = await request(app).get('/api/search?q=')
    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(2)
  })

  it('should respect limit parameter', async () => {
    await registry.publish(makeManifest({ name: 'pkg-a' }), Buffer.from('a'))
    await registry.publish(makeManifest({ name: 'pkg-b' }), Buffer.from('b'))
    await registry.publish(makeManifest({ name: 'pkg-c' }), Buffer.from('c'))

    const res = await request(app).get('/api/search?q=pkg&limit=2')
    expect(res.status).toBe(200)
    expect(res.body.results.length).toBeLessThanOrEqual(2)
  })

  it('should include query in response', async () => {
    const res = await request(app).get('/api/search?q=myquery')
    expect(res.status).toBe(200)
    expect(res.body.query).toBe('myquery')
  })
})
