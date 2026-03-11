import type Database from 'better-sqlite3'

const MIGRATIONS = [
  // packages table
  `CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    latest_version TEXT NOT NULL,
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // package_versions table
  `CREATE TABLE IF NOT EXISTS package_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    manifest TEXT NOT NULL DEFAULT '{}',
    tarball_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(package_id, version)
  )`,

  // FTS5 virtual table for full-text search
  `CREATE VIRTUAL TABLE IF NOT EXISTS packages_fts USING fts5(
    name, description, author, content=packages, content_rowid=id
  )`,

  // Triggers to keep FTS in sync
  `CREATE TRIGGER IF NOT EXISTS packages_ai AFTER INSERT ON packages BEGIN
    INSERT INTO packages_fts(rowid, name, description, author) VALUES (new.id, new.name, new.description, new.author);
  END`,

  `CREATE TRIGGER IF NOT EXISTS packages_au AFTER UPDATE ON packages BEGIN
    DELETE FROM packages_fts WHERE rowid = old.id;
    INSERT INTO packages_fts(rowid, name, description, author) VALUES (new.id, new.name, new.description, new.author);
  END`,

  `CREATE TRIGGER IF NOT EXISTS packages_ad AFTER DELETE ON packages BEGIN
    DELETE FROM packages_fts WHERE rowid = old.id;
  END`,

  // API keys table
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'publish',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
  )`,
]

export function runMigrations(db: Database.Database): void {
  for (const sql of MIGRATIONS) {
    db.exec(sql)
  }
}
