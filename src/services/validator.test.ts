import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createInMemoryDatabase } from '../db/database.js'
import { PackageValidator, isNewerCalVer } from './validator.js'
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

describe('PackageValidator', () => {
  let db: Database.Database
  let validator: PackageValidator

  beforeEach(() => {
    db = createInMemoryDatabase()
    validator = new PackageValidator(db)
  })

  afterEach(() => {
    db.close()
  })

  it('should pass validation for a valid new package', () => {
    const result = validator.validate(makeManifest(), 1024)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should detect duplicate name for new publish', () => {
    // Insert an existing package
    db.prepare(
      "INSERT INTO packages (name, description, author, latest_version) VALUES ('test-pkg', '', '', '2025.1.1')"
    ).run()

    const result = validator.validate(makeManifest(), 1024, true)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Package name "test-pkg" is already taken')
  })

  it('should detect duplicate version', () => {
    const info = db
      .prepare(
        "INSERT INTO packages (name, description, author, latest_version) VALUES ('test-pkg', '', '', '2025.1.1')"
      )
      .run()
    db.prepare(
      "INSERT INTO package_versions (package_id, version, manifest, tarball_path, size_bytes, checksum) VALUES (?, '2025.1.1', '{}', '/tmp/test', 0, 'abc')"
    ).run(info.lastInsertRowid)

    const result = validator.validate(makeManifest(), 1024)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('already exists'))).toBe(true)
  })

  it('should reject version that is not newer', () => {
    db.prepare(
      "INSERT INTO packages (name, description, author, latest_version) VALUES ('test-pkg', '', '', '2025.6.1')"
    ).run()

    const result = validator.validate(makeManifest({ version: '2025.1.1' }), 1024)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('not newer'))).toBe(true)
  })

  it('should reject tarball exceeding size limit', () => {
    const smallValidator = new PackageValidator(db, 100)
    const result = smallValidator.validate(makeManifest(), 200)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true)
  })

  it('should reject missing required fields', () => {
    const manifest = makeManifest({ name: '', version: '', realm: '' })
    const result = validator.validate(manifest, 1024)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should allow new version of existing package', () => {
    db.prepare(
      "INSERT INTO packages (name, description, author, latest_version) VALUES ('test-pkg', '', '', '2025.1.1')"
    ).run()

    const result = validator.validate(makeManifest({ version: '2025.2.1' }), 1024)
    expect(result.valid).toBe(true)
  })
})

describe('isNewerCalVer', () => {
  it('should return true when year is newer', () => {
    expect(isNewerCalVer('2026.1.1', '2025.12.31')).toBe(true)
  })

  it('should return true when month is newer', () => {
    expect(isNewerCalVer('2025.2.1', '2025.1.31')).toBe(true)
  })

  it('should return true when day is newer', () => {
    expect(isNewerCalVer('2025.1.2', '2025.1.1')).toBe(true)
  })

  it('should return false when versions are equal', () => {
    expect(isNewerCalVer('2025.1.1', '2025.1.1')).toBe(false)
  })

  it('should return false when version is older', () => {
    expect(isNewerCalVer('2025.1.1', '2025.6.1')).toBe(false)
  })
})
