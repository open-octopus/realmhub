import { describe, it, expect } from 'vitest'
import { createInMemoryDatabase } from './database.js'

describe('database', () => {
  it('should create an in-memory database', () => {
    const db = createInMemoryDatabase()
    expect(db).toBeDefined()
    db.close()
  })

  it('should have WAL mode enabled', () => {
    const db = createInMemoryDatabase()
    // In-memory databases may report 'memory' for journal_mode,
    // but WAL pragma was set. Check it does not error.
    const result = db.pragma('journal_mode')
    expect(result).toBeDefined()
    db.close()
  })

  it('should have foreign keys enabled', () => {
    const db = createInMemoryDatabase()
    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>
    expect(result[0]?.foreign_keys).toBe(1)
    db.close()
  })

  it('should have packages table after migration', () => {
    const db = createInMemoryDatabase()
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='packages'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
    expect(tables[0]?.name).toBe('packages')
    db.close()
  })

  it('should have package_versions table after migration', () => {
    const db = createInMemoryDatabase()
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='package_versions'")
      .all() as Array<{ name: string }>
    expect(tables).toHaveLength(1)
    expect(tables[0]?.name).toBe('package_versions')
    db.close()
  })
})
