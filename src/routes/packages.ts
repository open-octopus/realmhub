import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { Registry } from '../services/registry.js'
import type { PackageValidator } from '../services/validator.js'
import { RealmPackageSchema } from '../schema/package-schema.js'
import { ZodError } from 'zod'

export function createPackageRoutes(
  registry: Registry,
  validator: PackageValidator,
  requireAuth?: (scope: string) => RequestHandler
): Router {
  const router = Router()

  // Build middleware list for publish route
  const publishMiddleware: RequestHandler[] = []
  if (requireAuth) {
    publishMiddleware.push(requireAuth('publish'))
  }

  // List packages
  router.get('/', (req, res, next) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

      const result = registry.list(offset, limit)
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  // Get package details
  router.get('/:name', (req, res, next) => {
    try {
      const detail = registry.get(req.params.name)
      if (!detail) {
        res.status(404).json({ error: `Package "${req.params.name}" not found`, status: 404 })
        return
      }
      res.json(detail)
    } catch (err) {
      next(err)
    }
  })

  // Get specific version
  router.get('/:name/:version', (req, res, next) => {
    try {
      const ver = registry.getVersion(req.params.name, req.params.version)
      if (!ver) {
        res.status(404).json({
          error: `Version "${req.params.version}" not found for package "${req.params.name}"`,
          status: 404,
        })
        return
      }
      res.json(ver)
    } catch (err) {
      next(err)
    }
  })

  // Download latest version tarball
  router.get('/:name/latest/download', async (req, res, next) => {
    try {
      const detail = registry.get(req.params.name)
      if (!detail) {
        res.status(404).json({ error: `Package "${req.params.name}" not found`, status: 404 })
        return
      }

      const { data, checksum } = await registry.download(
        req.params.name,
        detail.latestVersion
      )

      res.setHeader('Content-Type', 'application/gzip')
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}-${detail.latestVersion}.tar.gz"`)
      res.setHeader('X-Checksum-SHA256', checksum)
      res.send(data)
    } catch (err) {
      next(err)
    }
  })

  // Download specific version tarball
  router.get('/:name/:version/download', async (req, res, next) => {
    try {
      const { data, checksum } = await registry.download(
        req.params.name,
        req.params.version
      )

      res.setHeader('Content-Type', 'application/gzip')
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}-${req.params.version}.tar.gz"`)
      res.setHeader('X-Checksum-SHA256', checksum)
      res.send(data)
    } catch (err) {
      next(err)
    }
  })

  // Publish package
  router.post('/', ...publishMiddleware, async (req, res, next) => {
    try {
      const body = req.body as { manifest?: unknown; tarball?: string }

      if (!body.manifest) {
        res.status(400).json({ error: 'Missing manifest in request body', status: 400 })
        return
      }

      if (!body.tarball) {
        res.status(400).json({ error: 'Missing tarball in request body (base64 encoded)', status: 400 })
        return
      }

      // Validate manifest schema
      let manifest
      try {
        manifest = RealmPackageSchema.parse(body.manifest)
      } catch (err) {
        if (err instanceof ZodError) {
          res.status(400).json({
            error: 'Invalid manifest',
            details: err.errors,
            status: 400,
          })
          return
        }
        throw err
      }

      // Decode tarball
      const tarball = Buffer.from(body.tarball as string, 'base64')

      // Semantic validation
      const existingPkg = registry.get(manifest.name)
      const validation = validator.validate(manifest, tarball.length, !existingPkg)
      if (!validation.valid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
          status: 400,
        })
        return
      }

      // Content validation
      const contentValidation = validator.validateTarballContent(tarball)
      if (!contentValidation.valid) {
        res.status(400).json({
          error: 'Content validation failed',
          details: contentValidation.errors,
          status: 400,
        })
        return
      }

      const result = await registry.publish(manifest, tarball)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  })

  return router
}
