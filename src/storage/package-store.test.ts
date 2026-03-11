import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { PackageStore } from './package-store.js'

describe('PackageStore', () => {
  let tmpDir: string
  let store: PackageStore

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'realmhub-test-'))
    store = new PackageStore(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should save and load a file roundtrip', async () => {
    const data = Buffer.from('hello world')
    await store.save('test-pkg', '2025.1.1', data)
    const loaded = await store.load('test-pkg', '2025.1.1')
    expect(loaded).toEqual(data)
  })

  it('should return correct SHA256 checksum on save', async () => {
    const data = Buffer.from('checksum test data')
    const result = await store.save('test-pkg', '2025.1.1', data)
    const expected = crypto.createHash('sha256').update(data).digest('hex')
    expect(result.checksum).toBe(expected)
  })

  it('should return correct size on save', async () => {
    const data = Buffer.from('size test')
    const result = await store.save('test-pkg', '2025.1.1', data)
    expect(result.size).toBe(data.length)
  })

  it('should report exists correctly', async () => {
    const data = Buffer.from('exists test')
    expect(await store.exists('test-pkg', '2025.1.1')).toBe(false)
    await store.save('test-pkg', '2025.1.1', data)
    expect(await store.exists('test-pkg', '2025.1.1')).toBe(true)
  })

  it('should delete a stored file', async () => {
    const data = Buffer.from('delete test')
    await store.save('test-pkg', '2025.1.1', data)
    expect(await store.exists('test-pkg', '2025.1.1')).toBe(true)
    await store.delete('test-pkg', '2025.1.1')
    expect(await store.exists('test-pkg', '2025.1.1')).toBe(false)
  })

  it('should throw when loading non-existent file', async () => {
    await expect(store.load('no-such-pkg', '2025.1.1')).rejects.toThrow(
      'Package no-such-pkg@2025.1.1 not found in storage'
    )
  })
})
