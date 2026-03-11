import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import express from 'express'
import request from 'supertest'
import { createInMemoryDatabase } from '../db/database.js'
import { PackageStore } from '../storage/package-store.js'
import { Registry } from '../services/registry.js'
import { PackageValidator } from '../services/validator.js'
import { createPackageRoutes } from './packages.js'
import { errorHandler } from '../middleware/error-handler.js'
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

/**
 * Create a minimal tar archive containing the given files, then gzip it.
 */
function makeTarball(files: Array<{ name: string; content: string }>): Buffer {
  const blocks: Buffer[] = []

  for (const file of files) {
    const content = Buffer.from(file.content, 'utf8')
    const header = Buffer.alloc(512, 0)

    // Filename (bytes 0-99)
    header.write(file.name, 0, Math.min(file.name.length, 100), 'utf8')

    // File mode (bytes 100-107)
    header.write('0000644\0', 100, 8, 'utf8')

    // Owner/group IDs (bytes 108-123)
    header.write('0001000\0', 108, 8, 'utf8')
    header.write('0001000\0', 116, 8, 'utf8')

    // File size in octal (bytes 124-135)
    header.write(content.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8')

    // Modification time (bytes 136-147)
    header.write('00000000000\0', 136, 12, 'utf8')

    // Typeflag (byte 156) — '0' for regular file
    header.write('0', 156, 1, 'utf8')

    // Checksum placeholder as spaces (bytes 148-155)
    header.write('        ', 148, 8, 'utf8')

    // Calculate checksum
    let checksum = 0
    for (let i = 0; i < 512; i++) {
      checksum += header[i]
    }
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8')

    blocks.push(header)

    // Content padded to 512-byte boundary
    const paddedSize = Math.ceil(content.length / 512) * 512
    const contentBlock = Buffer.alloc(paddedSize, 0)
    content.copy(contentBlock)
    blocks.push(contentBlock)
  }

  // End-of-archive marker
  blocks.push(Buffer.alloc(1024, 0))

  return gzipSync(Buffer.concat(blocks))
}

function makeValidTarball(): string {
  return makeTarball([{ name: 'REALM.md', content: '# Test Package\n' }]).toString('base64')
}

describe('packages routes', () => {
  let tmpDir: string
  let db: Database.Database
  let app: express.Express
  let registry: Registry

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'realmhub-routes-test-'))
    db = createInMemoryDatabase()
    const store = new PackageStore(tmpDir)
    registry = new Registry(db, store)
    const validator = new PackageValidator(db)

    app = express()
    app.use(express.json({ limit: '50mb' }))
    app.use('/api/packages', createPackageRoutes(registry, validator))
    app.use(errorHandler)
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should list packages (empty)', async () => {
    const res = await request(app).get('/api/packages')
    expect(res.status).toBe(200)
    expect(res.body.packages).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should publish a package', async () => {
    const manifest = makeManifest()
    const tarball = makeValidTarball()

    const res = await request(app)
      .post('/api/packages')
      .send({ manifest, tarball })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('test-pkg')
    expect(res.body.version).toBe('2025.1.1')
  })

  it('should reject tarball without REALM.md', async () => {
    const manifest = makeManifest()
    const tarball = makeTarball([{ name: 'index.js', content: 'console.log("hi")' }]).toString('base64')

    const res = await request(app)
      .post('/api/packages')
      .send({ manifest, tarball })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Content validation failed')
    expect(res.body.details).toContain('Package must contain a REALM.md file')
  })

  it('should get package details', async () => {
    await registry.publish(makeManifest(), Buffer.from('data'))

    const res = await request(app).get('/api/packages/test-pkg')
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('test-pkg')
    expect(res.body.versions).toHaveLength(1)
  })

  it('should get specific version', async () => {
    await registry.publish(makeManifest(), Buffer.from('data'))

    const res = await request(app).get('/api/packages/test-pkg/2025.1.1')
    expect(res.status).toBe(200)
    expect(res.body.version).toBe('2025.1.1')
  })

  it('should download a package tarball', async () => {
    const tarball = Buffer.from('download-data')
    await registry.publish(makeManifest(), tarball)

    const res = await request(app).get('/api/packages/test-pkg/2025.1.1/download')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/gzip')
    expect(res.headers['x-checksum-sha256']).toBeDefined()
    expect(Buffer.from(res.body)).toEqual(tarball)
  })

  it('should download latest version', async () => {
    await registry.publish(makeManifest(), Buffer.from('latest-data'))

    const res = await request(app).get('/api/packages/test-pkg/latest/download')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/gzip')
  })

  it('should return 404 for non-existent package', async () => {
    const res = await request(app).get('/api/packages/no-such-pkg')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('not found')
  })

  it('should return 400 for invalid manifest', async () => {
    const res = await request(app)
      .post('/api/packages')
      .send({
        manifest: { name: 'INVALID NAME', version: 'bad' },
        tarball: Buffer.from('data').toString('base64'),
      })
    expect(res.status).toBe(400)
  })

  it('should return 400 for missing tarball', async () => {
    const res = await request(app)
      .post('/api/packages')
      .send({ manifest: makeManifest() })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('tarball')
  })

  it('should list packages with pagination', async () => {
    await registry.publish(makeManifest({ name: 'pkg-a' }), Buffer.from('a'))
    await registry.publish(makeManifest({ name: 'pkg-b' }), Buffer.from('b'))
    await registry.publish(makeManifest({ name: 'pkg-c' }), Buffer.from('c'))

    const res = await request(app).get('/api/packages?offset=0&limit=2')
    expect(res.status).toBe(200)
    expect(res.body.packages).toHaveLength(2)
    expect(res.body.total).toBe(3)
  })
})
