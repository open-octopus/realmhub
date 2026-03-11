import crypto from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createInMemoryDatabase } from '../db/database.js'
import { AuthService } from './auth.js'
import type Database from 'better-sqlite3'

describe('AuthService', () => {
  let db: Database.Database
  let authService: AuthService

  beforeEach(() => {
    db = createInMemoryDatabase()
    authService = new AuthService(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('createKey', () => {
    it('should return a key with rh_live_ prefix and a numeric id', () => {
      const result = authService.createKey('read')
      expect(result.key).toMatch(/^rh_live_/)
      expect(typeof result.id).toBe('number')
      expect(result.id).toBeGreaterThan(0)
    })

    it('should return a key with rh_live_ prefix followed by 64 hex chars', () => {
      const result = authService.createKey('read')
      expect(result.key).toMatch(/^rh_live_[0-9a-f]{64}$/)
    })

    it('should store a SHA-256 hash in the DB, not the plaintext key', () => {
      const result = authService.createKey('read')
      const row = db
        .prepare('SELECT key_hash FROM api_keys WHERE id = ?')
        .get(result.id) as { key_hash: string }
      // The stored hash should match the SHA-256 of the plaintext key
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.key)
        .digest('hex')
      expect(row.key_hash).toBe(expectedHash)
      // The stored hash must NOT be the plaintext key
      expect(row.key_hash).not.toBe(result.key)
    })

    it('should store the first 12 chars of the key as key_prefix', () => {
      const result = authService.createKey('read')
      const row = db
        .prepare('SELECT key_prefix FROM api_keys WHERE id = ?')
        .get(result.id) as { key_prefix: string }
      expect(row.key_prefix).toBe(result.key.slice(0, 12))
    })
  })

  describe('validateKey', () => {
    it('should return valid: true with keyId for a valid key and matching scope', () => {
      const { key, id } = authService.createKey('read')
      const result = authService.validateKey(key, 'read')
      expect(result).toEqual({ valid: true, keyId: id })
    })

    it('should return valid: false for a non-existent key', () => {
      const result = authService.validateKey(
        'rh_live_' + 'a'.repeat(64),
        'read'
      )
      expect(result).toEqual({ valid: false })
    })

    it('should return valid: false for an empty string', () => {
      const result = authService.validateKey('', 'read')
      expect(result).toEqual({ valid: false })
    })

    it('should return valid: false for a key without rh_live_ prefix', () => {
      const result = authService.validateKey('some_random_key_value', 'read')
      expect(result).toEqual({ valid: false })
    })

    it('should allow admin scope to access any required scope', () => {
      const { key, id } = authService.createKey('admin')
      expect(authService.validateKey(key, 'read')).toEqual({
        valid: true,
        keyId: id,
      })
      expect(authService.validateKey(key, 'write')).toEqual({
        valid: true,
        keyId: id,
      })
      expect(authService.validateKey(key, 'admin')).toEqual({
        valid: true,
        keyId: id,
      })
    })
  })

  describe('revokeKey', () => {
    it('should cause validateKey to return false after revoking', () => {
      const { key, id } = authService.createKey('read')
      expect(authService.validateKey(key, 'read').valid).toBe(true)
      const revoked = authService.revokeKey(id)
      expect(revoked).toBe(true)
      expect(authService.validateKey(key, 'read')).toEqual({ valid: false })
    })

    it('should return false for a non-existent key id', () => {
      const result = authService.revokeKey(99999)
      expect(result).toBe(false)
    })

    it('should return false for an already-revoked key', () => {
      const { id } = authService.createKey('read')
      expect(authService.revokeKey(id)).toBe(true)
      expect(authService.revokeKey(id)).toBe(false)
    })
  })
})
