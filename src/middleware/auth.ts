import type { RequestHandler } from 'express'
import type { AuthService } from '../services/auth.js'

export function createAuthMiddleware(authService: AuthService) {
  function requireAuth(scope: string): RequestHandler {
    return (req, res, next) => {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        res.status(401).json({
          error: 'Missing Authorization header',
          status: 401,
        })
        return
      }

      const match = authHeader.match(/^Bearer\s+(rh_live_.+)$/)
      if (!match) {
        res.status(401).json({
          error: 'Invalid Authorization header format. Expected: Bearer rh_live_...',
          status: 401,
        })
        return
      }

      const key = match[1]
      const result = authService.validateKey(key, scope)

      if (!result.valid) {
        res.status(403).json({
          error: 'Invalid or insufficient API key',
          status: 403,
        })
        return
      }

      // Attach keyId to the request for downstream use
      ;(req as unknown as { keyId: number }).keyId = result.keyId!
      next()
    }
  }

  return requireAuth
}
