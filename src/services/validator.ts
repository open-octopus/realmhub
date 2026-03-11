import { gunzipSync } from 'node:zlib'
import type Database from 'better-sqlite3'
import type { RealmPackage } from '../schema/package-schema.js'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface PackageRow {
  id: number
  name: string
  latest_version: string
}

interface VersionRow {
  id: number
  version: string
}

const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

export class PackageValidator {
  constructor(
    private db: Database.Database,
    private maxSizeBytes: number = DEFAULT_MAX_SIZE_BYTES
  ) {}

  validate(
    manifest: RealmPackage,
    tarballSize: number,
    isNewPackage?: boolean
  ): ValidationResult {
    const errors: string[] = []

    // Check required fields
    if (!manifest.name) {
      errors.push('Package name is required')
    }
    if (!manifest.version) {
      errors.push('Package version is required')
    }
    if (!manifest.realm) {
      errors.push('Target realm is required')
    }

    // Check tarball size limit
    if (tarballSize > this.maxSizeBytes) {
      errors.push(
        `Tarball size ${tarballSize} exceeds maximum ${this.maxSizeBytes} bytes`
      )
    }

    // Check name uniqueness for new packages
    const existingPkg = this.db
      .prepare('SELECT id, name, latest_version FROM packages WHERE name = ?')
      .get(manifest.name) as PackageRow | undefined

    if (isNewPackage && existingPkg) {
      errors.push(`Package name "${manifest.name}" is already taken`)
    }

    if (existingPkg) {
      // Check version doesn't already exist
      const existingVersion = this.db
        .prepare(
          'SELECT id FROM package_versions WHERE package_id = ? AND version = ?'
        )
        .get(existingPkg.id, manifest.version) as VersionRow | undefined

      if (existingVersion) {
        errors.push(
          `Version ${manifest.version} already exists for package ${manifest.name}`
        )
      }

      // Check version is newer than latest (CalVer comparison)
      if (
        existingPkg.latest_version &&
        !isNewerCalVer(manifest.version, existingPkg.latest_version)
      ) {
        errors.push(
          `Version ${manifest.version} is not newer than latest version ${existingPkg.latest_version}`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  validateTarballContent(tarball: Buffer): ValidationResult {
    const errors: string[] = []

    let decompressed: Buffer
    try {
      decompressed = gunzipSync(tarball)
    } catch {
      // If decompression fails, the tarball may not be gzipped — treat raw as tar
      decompressed = tarball
    }

    // Parse tar to extract filenames
    const filenames = parseTarFilenames(decompressed)

    // Check for REALM.md
    const hasRealmMd = filenames.some(
      (name) => name === 'REALM.md' || name.endsWith('/REALM.md')
    )
    if (!hasRealmMd) {
      errors.push('Package must contain a REALM.md file')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

/**
 * Parse tar archive and extract filenames from 512-byte header blocks.
 * Tar headers: bytes 0-99 = filename, bytes 124-135 = size (octal).
 */
function parseTarFilenames(data: Buffer): string[] {
  const filenames: string[] = []
  let offset = 0

  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512)

    // Check if this is an empty block (end of archive)
    const isEmpty = header.every((b) => b === 0)
    if (isEmpty) break

    // Read filename from bytes 0-99 (null-terminated)
    const nameEnd = header.indexOf(0, 0)
    const name = header
      .subarray(0, nameEnd > 0 && nameEnd < 100 ? nameEnd : 100)
      .toString('utf8')
      .trim()

    if (name) {
      filenames.push(name)
    }

    // Read file size from bytes 124-135 (octal, null/space terminated)
    const sizeStr = header.subarray(124, 136).toString('utf8').trim()
    const size = parseInt(sizeStr, 8) || 0

    // Advance past this header + content blocks (content padded to 512-byte boundary)
    const contentBlocks = Math.ceil(size / 512)
    offset += 512 + contentBlocks * 512
  }

  return filenames
}

/**
 * Compare two CalVer versions (YYYY.M.D format).
 * Returns true if `a` is strictly newer than `b`.
 */
export function isNewerCalVer(a: string, b: string): boolean {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    const va = partsA[i] ?? 0
    const vb = partsB[i] ?? 0
    if (va > vb) return true
    if (va < vb) return false
  }
  return false // Equal
}
