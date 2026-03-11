import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createInMemoryDatabase } from '../db/database.js'
import { PackageStore } from '../storage/package-store.js'
import { Registry, ConflictError, NotFoundError } from './registry.js'
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

describe('Registry', () => {
  let tmpDir: string
  let db: Database.Database
  let store: PackageStore
  let registry: Registry

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'realmhub-reg-test-'))
    db = createInMemoryDatabase()
    store = new PackageStore(tmpDir)
    registry = new Registry(db, store)
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should publish a new package', async () => {
    const manifest = makeManifest()
    const tarball = Buffer.from('test-tarball-data')
    const result = await registry.publish(manifest, tarball)
    expect(result.name).toBe('test-pkg')
    expect(result.version).toBe('2025.1.1')
  })

  it('should publish a new version of existing package', async () => {
    const tarball = Buffer.from('data')
    await registry.publish(makeManifest(), tarball)

    const v2 = makeManifest({ version: '2025.2.1' })
    const result = await registry.publish(v2, tarball)
    expect(result.version).toBe('2025.2.1')
  })

  it('should reject duplicate version', async () => {
    const manifest = makeManifest()
    const tarball = Buffer.from('data')
    await registry.publish(manifest, tarball)

    await expect(registry.publish(manifest, tarball)).rejects.toThrow(ConflictError)
  })

  it('should search by name', async () => {
    const tarball = Buffer.from('data')
    await registry.publish(makeManifest({ name: 'pet-care', description: 'Pet management' }), tarball)
    await registry.publish(makeManifest({ name: 'finance-tracker', description: 'Track finances' }), tarball)

    const results = registry.search('pet')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some((r) => r.name === 'pet-care')).toBe(true)
  })

  it('should search by description', async () => {
    const tarball = Buffer.from('data')
    await registry.publish(makeManifest({ name: 'my-realm', description: 'Manage your garden beautifully' }), tarball)

    const results = registry.search('garden')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0]?.name).toBe('my-realm')
  })

  it('should get package details', async () => {
    const tarball = Buffer.from('data')
    await registry.publish(makeManifest(), tarball)

    const detail = registry.get('test-pkg')
    expect(detail).not.toBeNull()
    expect(detail!.name).toBe('test-pkg')
    expect(detail!.versions).toHaveLength(1)
    expect(detail!.versions[0]?.version).toBe('2025.1.1')
  })

  it('should get specific version', async () => {
    const tarball = Buffer.from('data')
    await registry.publish(makeManifest(), tarball)

    const ver = registry.getVersion('test-pkg', '2025.1.1')
    expect(ver).not.toBeNull()
    expect(ver!.version).toBe('2025.1.1')
    expect(ver!.manifest.name).toBe('test-pkg')
  })

  it('should download and increment counter', async () => {
    const tarball = Buffer.from('download-test-data')
    await registry.publish(makeManifest(), tarball)

    const result = await registry.download('test-pkg', '2025.1.1')
    expect(result.data).toEqual(tarball)

    const detail = registry.get('test-pkg')
    expect(detail!.downloads).toBe(1)
  })

  it('should list with pagination', async () => {
    const tarball = Buffer.from('data')
    await registry.publish(makeManifest({ name: 'pkg-a' }), tarball)
    await registry.publish(makeManifest({ name: 'pkg-b' }), tarball)
    await registry.publish(makeManifest({ name: 'pkg-c' }), tarball)

    const page1 = registry.list(0, 2)
    expect(page1.packages).toHaveLength(2)
    expect(page1.total).toBe(3)

    const page2 = registry.list(2, 2)
    expect(page2.packages).toHaveLength(1)
    expect(page2.total).toBe(3)
  })

  it('should return null for non-existent package', () => {
    const detail = registry.get('non-existent')
    expect(detail).toBeNull()
  })

  it('should throw NotFoundError when downloading non-existent package', async () => {
    await expect(registry.download('no-pkg', '2025.1.1')).rejects.toThrow(NotFoundError)
  })
})
