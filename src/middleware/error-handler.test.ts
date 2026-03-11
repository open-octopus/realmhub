import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from './error-handler.js'

// Silence consola.error output during tests
vi.mock('consola', () => ({
  consola: { error: vi.fn() },
}))

function createApp(errorToThrow: unknown) {
  const app = express()
  app.get('/test', () => {
    throw errorToThrow
  })
  app.use(errorHandler)
  return app
}

describe('error-handler', () => {
  it('should use the status property from the error when present', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 })
    const app = createApp(err)

    const res = await request(app).get('/test')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not Found')
    expect(res.body.status).toBe(404)
  })

  it('should default to 500 when error has no status', async () => {
    const err = new Error('Something broke')
    const app = createApp(err)

    const res = await request(app).get('/test')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Something broke')
    expect(res.body.status).toBe(500)
  })

  it('should return the message from an Error instance', async () => {
    const err = new Error('Detailed failure message')
    const app = createApp(err)

    const res = await request(app).get('/test')

    expect(res.body.error).toBe('Detailed failure message')
  })

  it('should return "Internal Server Error" for non-Error values', async () => {
    const app = createApp('just a string')

    const res = await request(app).get('/test')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal Server Error')
    expect(res.body.status).toBe(500)
  })
})
