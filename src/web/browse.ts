import { Router } from 'express'
import type { Registry, PackageSummary } from '../services/registry.js'

function renderPackageList(packages: PackageSummary[], total: number): string {
  const rows = packages
    .map(
      (pkg) => `
      <tr>
        <td><a href="/packages/${pkg.name}">${pkg.name}</a></td>
        <td>${escapeHtml(pkg.description)}</td>
        <td>${escapeHtml(pkg.author)}</td>
        <td><code>${pkg.latestVersion}</code></td>
        <td>${pkg.downloads}</td>
      </tr>`
    )
    .join('\n')

  const emptyState =
    packages.length === 0
      ? '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#666;">No packages published yet. Be the first to share a Realm!</td></tr>'
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RealmHub — Realm Package Marketplace</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    header { background: #6C3FA0; color: white; padding: 2rem; text-align: center; }
    header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    header p { opacity: 0.85; }
    .search-bar { max-width: 600px; margin: -1.5rem auto 0; position: relative; z-index: 1; }
    .search-bar input { width: 100%; padding: 0.75rem 1rem; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem; }
    .search-bar input:focus { outline: none; border-color: #00D4AA; }
    main { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #6C3FA0; color: white; padding: 0.75rem 1rem; text-align: left; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    tr:hover td { background: #f9f9f9; }
    a { color: #00D4AA; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    code { background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    .stats { text-align: center; margin-bottom: 1.5rem; color: #666; }
    footer { text-align: center; padding: 2rem; color: #999; font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <h1>RealmHub</h1>
    <p>The Realm Package Marketplace for OpenOctopus</p>
  </header>
  <main>
    <div class="search-bar">
      <form action="/api/search" method="get">
        <input type="text" name="q" placeholder="Search realms..." />
      </form>
    </div>
    <p class="stats">${total} package${total !== 1 ? 's' : ''} available</p>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
          <th>Author</th>
          <th>Version</th>
          <th>Downloads</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${emptyState}
      </tbody>
    </table>
  </main>
  <footer>
    RealmHub &mdash; part of the OpenOctopus ecosystem
  </footer>
</body>
</html>`
}

function renderPackageDetail(
  name: string,
  detail: {
    description: string
    author: string
    latestVersion: string
    downloads: number
    createdAt: string
    versions: { version: string; sizeBytes: number; publishedAt: string }[]
  }
): string {
  const versionRows = detail.versions
    .map(
      (v) => `
      <tr>
        <td><code>${v.version}</code></td>
        <td>${formatBytes(v.sizeBytes)}</td>
        <td>${v.publishedAt}</td>
        <td><a href="/api/packages/${name}/${v.version}/download">Download</a></td>
      </tr>`
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)} — RealmHub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    header { background: #6C3FA0; color: white; padding: 1.5rem 2rem; }
    header a { color: #00D4AA; }
    main { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { color: #6C3FA0; margin-bottom: 0.5rem; }
    .meta { color: #666; margin-bottom: 1rem; }
    .meta span { margin-right: 1.5rem; }
    .install { background: #1E3A5F; color: #00D4AA; padding: 0.75rem 1rem; border-radius: 6px; font-family: monospace; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #6C3FA0; color: white; padding: 0.5rem 0.75rem; text-align: left; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
    a { color: #00D4AA; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
    code { background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
  </style>
</head>
<body>
  <header>
    <a href="/">&larr; Back to RealmHub</a>
  </header>
  <main>
    <div class="card">
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(detail.description)}</p>
      <div class="meta">
        <span>Author: <strong>${escapeHtml(detail.author)}</strong></span>
        <span>Downloads: <strong>${detail.downloads}</strong></span>
        <span>Latest: <code>${detail.latestVersion}</code></span>
      </div>
      <div class="install">tentacle realm install ${escapeHtml(name)}</div>
    </div>
    <div class="card">
      <h2>Versions</h2>
      <table>
        <thead>
          <tr><th>Version</th><th>Size</th><th>Published</th><th></th></tr>
        </thead>
        <tbody>
          ${versionRows}
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>`
}

function render404(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Not Found — RealmHub</title>
<style>body{font-family:sans-serif;text-align:center;padding:4rem;color:#666;}a{color:#00D4AA;}</style>
</head>
<body><h1>Package Not Found</h1><p><a href="/">Back to RealmHub</a></p></body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function createBrowseRoutes(registry: Registry): Router {
  const router = Router()

  // Browse package list
  router.get('/', (req, res, next) => {
    try {
      const accept = req.headers.accept ?? ''
      if (!accept.includes('text/html') && accept.includes('application/json')) {
        next()
        return
      }

      const { packages, total } = registry.list(0, 50)
      const html = renderPackageList(packages, total)
      res.type('html').send(html)
    } catch (err) {
      next(err)
    }
  })

  // Browse package detail
  router.get('/packages/:name', (req, res, next) => {
    try {
      const detail = registry.get(req.params.name)
      if (!detail) {
        res.status(404).type('html').send(render404())
        return
      }

      const html = renderPackageDetail(req.params.name, detail)
      res.type('html').send(html)
    } catch (err) {
      next(err)
    }
  })

  return router
}
