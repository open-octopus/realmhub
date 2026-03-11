import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export class PackageStore {
  constructor(private storagePath: string) {}

  private getFilePath(name: string, version: string): string {
    return path.join(this.storagePath, name, `${version}.tar.gz`)
  }

  async save(
    name: string,
    version: string,
    data: Buffer
  ): Promise<{ path: string; checksum: string; size: number }> {
    const filePath = this.getFilePath(name, version)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)

    const checksum = crypto.createHash('sha256').update(data).digest('hex')

    return {
      path: filePath,
      checksum,
      size: data.length,
    }
  }

  async load(name: string, version: string): Promise<Buffer> {
    const filePath = this.getFilePath(name, version)
    try {
      return await fs.readFile(filePath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Package ${name}@${version} not found in storage`)
      }
      throw err
    }
  }

  async exists(name: string, version: string): Promise<boolean> {
    const filePath = this.getFilePath(name, version)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async delete(name: string, version: string): Promise<void> {
    const filePath = this.getFilePath(name, version)
    try {
      await fs.unlink(filePath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return // Already deleted
      }
      throw err
    }
  }
}
