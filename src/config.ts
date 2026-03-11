import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'

const ConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(19800),
  dataDir: z.string().default('~/.realmhub'),
})

export interface RealmHubConfig {
  port: number
  dataDir: string
  storagePath: string
  dbPath: string
}

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1))
  }
  return filepath
}

export function loadConfig(env: Record<string, string | undefined> = process.env): RealmHubConfig {
  const raw = ConfigSchema.parse({
    port: env.PORT ?? undefined,
    dataDir: env.DATA_DIR ?? undefined,
  })

  const dataDir = expandHome(raw.dataDir)

  return {
    port: raw.port,
    dataDir,
    storagePath: path.join(dataDir, 'packages'),
    dbPath: path.join(dataDir, 'realmhub.db'),
  }
}
