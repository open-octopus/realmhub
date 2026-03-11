import { Router } from 'express'
import type { Registry } from '../services/registry.js'

export function createSearchRoutes(registry: Registry): Router {
  const router = Router()

  // Full-text search
  router.get('/', (req, res, next) => {
    try {
      const query = (req.query.q as string) ?? ''
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

      const results = registry.search(query, limit)
      res.json({
        results,
        total: results.length,
        query,
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
