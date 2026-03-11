import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  return db
}

describe('migrations', () => {
  it('should create packages table', () => {
    const db = createTestDb()
    runMigrations(db)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='packages'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
    db.close()
  })

  it('should create package_versions table', () => {
    const db = createTestDb()
    runMigrations(db)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='package_versions'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
    db.close()
  })

  it('should create FTS table', () => {
    const db = createTestDb()
    runMigrations(db)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='packages_fts'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
    db.close()
  })

  it('should create triggers', () => {
    const db = createTestDb()
    runMigrations(db)
    const triggers = db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger'")
      .all() as Array<{ name: string }>
    const triggerNames = triggers.map((t) => t.name)
    expect(triggerNames).toContain('packages_ai')
    expect(triggerNames).toContain('packages_au')
    expect(triggerNames).toContain('packages_ad')
    db.close()
  })

  it('should be idempotent (run twice without error)', () => {
    const db = createTestDb()
    runMigrations(db)
    runMigrations(db)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='packages'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
    db.close()
  })
})
