import express from 'express'
import type { Express } from 'express'
import type Database from 'better-sqlite3'
import { createDatabase, createInMemoryDatabase } from './db/database.js'
import { PackageStore } from './storage/package-store.js'
import { Registry } from './services/registry.js'
import { PackageValidator } from './services/validator.js'
import { AuthService } from './services/auth.js'
import { createPackageRoutes } from './routes/packages.js'
import { createSearchRoutes } from './routes/search.js'
import { createAuthRoutes } from './routes/auth.js'
import { createHealthRoutes } from './routes/health.js'
import { createBrowseRoutes } from './web/browse.js'
import { errorHandler } from './middleware/error-handler.js'
import { createRateLimiter } from './middleware/rate-limiter.js'
import { createAuthMiddleware } from './middleware/auth.js'
import type { RealmHubConfig } from './config.js'

export interface AppContext {
  app: Express
  db: Database.Database
  registry: Registry
  authService: AuthService
  close: () => void
}

export function createApp(config: RealmHubConfig): AppContext {
  const db = createDatabase(config.dbPath)
  return createAppWithDb(db, config)
}

export function createTestApp(config?: Partial<RealmHubConfig>): AppContext {
  const db = createInMemoryDatabase()
  const resolved: RealmHubConfig = {
    port: config?.port ?? 19800,
    dataDir: config?.dataDir ?? '/tmp/realmhub-test',
    storagePath: config?.storagePath ?? '/tmp/realmhub-test/packages',
    dbPath: config?.dbPath ?? ':memory:',
  }
  return createAppWithDb(db, resolved)
}

function createAppWithDb(db: Database.Database, config: RealmHubConfig): AppContext {
  const store = new PackageStore(config.storagePath)
  const registry = new Registry(db, store)
  const validator = new PackageValidator(db)
  const authService = new AuthService(db)
  const requireAuth = createAuthMiddleware(authService)

  const app = express()

  // Middleware
  app.use(createRateLimiter())
  app.use(express.json({ limit: '60mb' }))

  // Routes
  app.use('/', createHealthRoutes())
  app.use('/', createBrowseRoutes(registry))
  app.use('/api/packages', createPackageRoutes(registry, validator, requireAuth))
  app.use('/api/keys', createAuthRoutes(authService, requireAuth))
  app.use('/api/search', createSearchRoutes(registry))

  // Error handler (must be last)
  app.use(errorHandler)

  const close = () => {
    db.close()
  }

  return { app, db, registry, authService, close }
}
