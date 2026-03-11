import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations.js'

export function createDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath)
  fs.mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

export function createInMemoryDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}
