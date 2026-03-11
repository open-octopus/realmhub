import type Database from 'better-sqlite3'
import type { PackageStore } from '../storage/package-store.js'
import type { RealmPackage } from '../schema/package-schema.js'

export interface PackageSummary {
  name: string
  description: string
  author: string
  latestVersion: string
  downloads: number
  updatedAt: string
}

export interface PackageDetail extends PackageSummary {
  createdAt: string
  versions: PackageVersionDetail[]
}

export interface PackageVersionDetail {
  version: string
  manifest: RealmPackage
  sizeBytes: number
  checksum: string
  publishedAt: string
}

interface PackageRow {
  id: number
  name: string
  description: string
  author: string
  latest_version: string
  downloads: number
  created_at: string
  updated_at: string
}

interface VersionRow {
  id: number
  package_id: number
  version: string
  manifest: string
  tarball_path: string
  size_bytes: number
  checksum: string
  published_at: string
}

export class Registry {
  constructor(
    private db: Database.Database,
    private store: PackageStore
  ) {}

  async publish(
    manifest: RealmPackage,
    tarball: Buffer
  ): Promise<{ name: string; version: string }> {
    // Check if version already exists
    const existingPkg = this.db
      .prepare('SELECT id FROM packages WHERE name = ?')
      .get(manifest.name) as PackageRow | undefined

    if (existingPkg) {
      const existingVersion = this.db
        .prepare(
          'SELECT id FROM package_versions WHERE package_id = ? AND version = ?'
        )
        .get(existingPkg.id, manifest.version) as VersionRow | undefined

      if (existingVersion) {
        throw new ConflictError(
          `Version ${manifest.version} already exists for package ${manifest.name}`
        )
      }
    }

    // Store the tarball
    const { path: tarballPath, checksum, size } = await this.store.save(
      manifest.name,
      manifest.version,
      tarball
    )

    // Insert or update in a transaction
    const transaction = this.db.transaction(() => {
      if (existingPkg) {
        // Update existing package
        this.db
          .prepare(
            `UPDATE packages SET description = ?, author = ?, latest_version = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .run(manifest.description, manifest.author, manifest.version, existingPkg.id)

        // Insert version
        this.db
          .prepare(
            `INSERT INTO package_versions (package_id, version, manifest, tarball_path, size_bytes, checksum) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            existingPkg.id,
            manifest.version,
            JSON.stringify(manifest),
            tarballPath,
            size,
            checksum
          )
      } else {
        // Insert new package
        const result = this.db
          .prepare(
            `INSERT INTO packages (name, description, author, latest_version) VALUES (?, ?, ?, ?)`
          )
          .run(manifest.name, manifest.description, manifest.author, manifest.version)

        const packageId = result.lastInsertRowid

        // Insert version
        this.db
          .prepare(
            `INSERT INTO package_versions (package_id, version, manifest, tarball_path, size_bytes, checksum) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            packageId,
            manifest.version,
            JSON.stringify(manifest),
            tarballPath,
            size,
            checksum
          )
      }
    })

    transaction()

    return { name: manifest.name, version: manifest.version }
  }

  search(query: string, limit: number = 20): PackageSummary[] {
    if (!query.trim()) {
      return this.list(0, limit).packages
    }

    // Sanitize the FTS query — escape special characters and append *
    const sanitized = query.replace(/['"]/g, '').trim()
    if (!sanitized) {
      return this.list(0, limit).packages
    }

    const ftsQuery = sanitized
      .split(/\s+/)
      .map((term) => `"${term}"*`)
      .join(' ')

    try {
      const rows = this.db
        .prepare(
          `SELECT p.name, p.description, p.author, p.latest_version, p.downloads, p.updated_at
           FROM packages_fts fts
           JOIN packages p ON p.id = fts.rowid
           WHERE packages_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(ftsQuery, limit) as PackageRow[]

      return rows.map(toSummary)
    } catch {
      // If FTS query fails, fall back to LIKE search
      const rows = this.db
        .prepare(
          `SELECT name, description, author, latest_version, downloads, updated_at
           FROM packages
           WHERE name LIKE ? OR description LIKE ? OR author LIKE ?
           ORDER BY downloads DESC
           LIMIT ?`
        )
        .all(`%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`, limit) as PackageRow[]

      return rows.map(toSummary)
    }
  }

  get(name: string): PackageDetail | null {
    const pkg = this.db
      .prepare('SELECT * FROM packages WHERE name = ?')
      .get(name) as PackageRow | undefined

    if (!pkg) return null

    const versions = this.db
      .prepare(
        'SELECT * FROM package_versions WHERE package_id = ? ORDER BY published_at DESC'
      )
      .all(pkg.id) as VersionRow[]

    return {
      name: pkg.name,
      description: pkg.description,
      author: pkg.author,
      latestVersion: pkg.latest_version,
      downloads: pkg.downloads,
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at,
      versions: versions.map((v) => ({
        version: v.version,
        manifest: JSON.parse(v.manifest) as RealmPackage,
        sizeBytes: v.size_bytes,
        checksum: v.checksum,
        publishedAt: v.published_at,
      })),
    }
  }

  getVersion(name: string, version: string): PackageVersionDetail | null {
    const pkg = this.db
      .prepare('SELECT id FROM packages WHERE name = ?')
      .get(name) as PackageRow | undefined

    if (!pkg) return null

    const ver = this.db
      .prepare(
        'SELECT * FROM package_versions WHERE package_id = ? AND version = ?'
      )
      .get(pkg.id, version) as VersionRow | undefined

    if (!ver) return null

    return {
      version: ver.version,
      manifest: JSON.parse(ver.manifest) as RealmPackage,
      sizeBytes: ver.size_bytes,
      checksum: ver.checksum,
      publishedAt: ver.published_at,
    }
  }

  async download(
    name: string,
    version: string
  ): Promise<{ data: Buffer; checksum: string }> {
    const pkg = this.db
      .prepare('SELECT id FROM packages WHERE name = ?')
      .get(name) as PackageRow | undefined

    if (!pkg) {
      throw new NotFoundError(`Package ${name} not found`)
    }

    const ver = this.db
      .prepare(
        'SELECT * FROM package_versions WHERE package_id = ? AND version = ?'
      )
      .get(pkg.id, version) as VersionRow | undefined

    if (!ver) {
      throw new NotFoundError(`Version ${version} not found for package ${name}`)
    }

    // Increment download counter
    this.db
      .prepare('UPDATE packages SET downloads = downloads + 1 WHERE id = ?')
      .run(pkg.id)

    const data = await this.store.load(name, version)
    return { data, checksum: ver.checksum }
  }

  list(
    offset: number = 0,
    limit: number = 20
  ): { packages: PackageSummary[]; total: number } {
    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM packages')
      .get() as { count: number }

    const rows = this.db
      .prepare(
        'SELECT name, description, author, latest_version, downloads, updated_at FROM packages ORDER BY downloads DESC LIMIT ? OFFSET ?'
      )
      .all(limit, offset) as PackageRow[]

    return {
      packages: rows.map(toSummary),
      total: countRow.count,
    }
  }
}

function toSummary(row: PackageRow): PackageSummary {
  return {
    name: row.name,
    description: row.description,
    author: row.author,
    latestVersion: row.latest_version,
    downloads: row.downloads,
    updatedAt: row.updated_at,
  }
}

export class ConflictError extends Error {
  status = 409
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  status = 404
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}
