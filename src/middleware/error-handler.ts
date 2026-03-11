import type { ErrorRequestHandler } from 'express'
import { consola } from 'consola'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  consola.error(err)

  const status =
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500

  const message =
    err instanceof Error ? err.message : 'Internal Server Error'

  res.status(status).json({
    error: message,
    status,
  })
}
