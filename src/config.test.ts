import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from './config.js'

describe('config', () => {
  it('should use default values when no env vars set', () => {
    const config = loadConfig({})
    expect(config.port).toBe(19800)
    expect(config.dataDir).toBe(path.join(os.homedir(), '.realmhub'))
  })

  it('should use custom port from env', () => {
    const config = loadConfig({ PORT: '3000' })
    expect(config.port).toBe(3000)
  })

  it('should expand ~ in dataDir', () => {
    const config = loadConfig({ DATA_DIR: '~/my-realmhub' })
    expect(config.dataDir).toBe(path.join(os.homedir(), 'my-realmhub'))
  })

  it('should derive storagePath and dbPath from dataDir', () => {
    const config = loadConfig({ DATA_DIR: '/tmp/test-realmhub' })
    expect(config.storagePath).toBe('/tmp/test-realmhub/packages')
    expect(config.dbPath).toBe('/tmp/test-realmhub/realmhub.db')
  })

  it('should reject invalid port numbers', () => {
    expect(() => loadConfig({ PORT: '99999' })).toThrow()
    expect(() => loadConfig({ PORT: '-1' })).toThrow()
    expect(() => loadConfig({ PORT: 'abc' })).toThrow()
  })
})
