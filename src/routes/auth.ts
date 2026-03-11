import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { AuthService } from '../services/auth.js'

export function createAuthRoutes(
  authService: AuthService,
  requireAuth: (scope: string) => RequestHandler
): Router {
  const router = Router()

  // Create a new API key (requires admin scope)
  router.post('/', requireAuth('admin'), (req, res, next) => {
    try {
      const body = req.body as { scope?: string; description?: string }

      if (!body.scope) {
        res.status(400).json({
          error: 'Missing scope in request body',
          status: 400,
        })
        return
      }

      const result = authService.createKey(body.scope, body.description)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  })

  // Revoke an API key (requires admin scope)
  router.delete('/:id', requireAuth('admin'), (req, res, next) => {
    try {
      const keyId = parseInt(req.params.id as string)
      if (isNaN(keyId)) {
        res.status(400).json({
          error: 'Invalid key ID',
          status: 400,
        })
        return
      }

      const success = authService.revokeKey(keyId)
      res.json({ success })
    } catch (err) {
      next(err)
    }
  })

  return router
}
