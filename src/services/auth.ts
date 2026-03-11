import crypto from 'node:crypto'
import type Database from 'better-sqlite3'

interface ApiKeyRow {
  id: number
  key_hash: string
  key_prefix: string
  scope: string
  description: string
  created_at: string
  revoked_at: string | null
}

export class AuthService {
  constructor(private db: Database.Database) {}

  createKey(
    scope: string,
    description?: string
  ): { key: string; id: number } {
    const raw = crypto.randomBytes(32).toString('hex')
    const key = `rh_live_${raw}`
    const keyHash = crypto.createHash('sha256').update(key).digest('hex')
    const keyPrefix = key.slice(0, 12)

    const result = this.db
      .prepare(
        `INSERT INTO api_keys (key_hash, key_prefix, scope, description) VALUES (?, ?, ?, ?)`
      )
      .run(keyHash, keyPrefix, scope, description ?? '')

    return { key, id: Number(result.lastInsertRowid) }
  }

  validateKey(
    key: string,
    requiredScope: string
  ): { valid: boolean; keyId?: number } {
    if (!key || !key.startsWith('rh_live_')) {
      return { valid: false }
    }

    const keyHash = crypto.createHash('sha256').update(key).digest('hex')

    const row = this.db
      .prepare(
        'SELECT id, scope, revoked_at FROM api_keys WHERE key_hash = ?'
      )
      .get(keyHash) as ApiKeyRow | undefined

    if (!row) {
      return { valid: false }
    }

    if (row.revoked_at) {
      return { valid: false }
    }

    // Check scope: 'admin' scope has access to everything
    if (row.scope !== requiredScope && row.scope !== 'admin') {
      return { valid: false }
    }

    return { valid: true, keyId: row.id }
  }

  revokeKey(keyId: number): boolean {
    const result = this.db
      .prepare(
        `UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`
      )
      .run(keyId)

    return result.changes > 0
  }
}
