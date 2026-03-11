#!/usr/bin/env node
import { createApp } from './server.js'
import { loadConfig } from './config.js'
import { consola } from 'consola'

const config = loadConfig()
const { app, close } = createApp(config)

const server = app.listen(config.port, () => {
  consola.success(`RealmHub listening on port ${config.port}`)
  consola.info(`Browse: http://localhost:${config.port}`)
  consola.info(`API: http://localhost:${config.port}/api/packages`)
})

function shutdown() {
  consola.info('Shutting down...')
  close()
  server.close()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
