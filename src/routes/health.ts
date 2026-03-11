import { Router } from 'express'

export function createHealthRoutes(): Router {
  const router = Router()

  router.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      version: '2025.1.0',
      uptime: process.uptime(),
    })
  })

  return router
}
