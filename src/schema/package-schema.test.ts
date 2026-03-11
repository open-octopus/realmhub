import { describe, it, expect } from 'vitest'
import { RealmPackageSchema } from './package-schema.js'

describe('RealmPackageSchema', () => {
  const validPackage = {
    name: 'pet-care',
    version: '2025.1.15',
    description: 'A realm for pet care management',
    author: 'octopus-team',
    realm: 'pet',
    skills: ['vet-lookup', 'feeding-schedule'],
    dependencies: {},
    engine: '>=22',
  }

  it('should parse a valid package', () => {
    const result = RealmPackageSchema.parse(validPackage)
    expect(result.name).toBe('pet-care')
    expect(result.version).toBe('2025.1.15')
    expect(result.realm).toBe('pet')
  })

  it('should apply default values', () => {
    const minimal = { name: 'minimal', version: '2025.1.1', realm: 'test' }
    const result = RealmPackageSchema.parse(minimal)
    expect(result.description).toBe('')
    expect(result.author).toBe('')
    expect(result.skills).toEqual([])
    expect(result.dependencies).toEqual({})
    expect(result.engine).toBe('>=22')
  })

  it('should enforce lowercase alphanumeric with hyphens for name', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, name: 'Invalid_Name' })
    ).toThrow('Package name must be lowercase alphanumeric with hyphens')
  })

  it('should reject names with spaces', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, name: 'has space' })
    ).toThrow()
  })

  it('should enforce CalVer format for version', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, version: '1.0.0' })
    ).toThrow('Version must be CalVer YYYY.M.D')
  })

  it('should accept valid CalVer versions', () => {
    const v1 = RealmPackageSchema.parse({ ...validPackage, version: '2025.1.1' })
    expect(v1.version).toBe('2025.1.1')

    const v2 = RealmPackageSchema.parse({ ...validPackage, version: '2025.12.31' })
    expect(v2.version).toBe('2025.12.31')
  })

  it('should reject empty name', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, name: '' })
    ).toThrow()
  })

  it('should reject description exceeding max length', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, description: 'x'.repeat(501) })
    ).toThrow()
  })

  it('should reject author exceeding max length', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, author: 'x'.repeat(129) })
    ).toThrow()
  })

  it('should reject name exceeding max length', () => {
    expect(() =>
      RealmPackageSchema.parse({ ...validPackage, name: 'a'.repeat(129) })
    ).toThrow()
  })
})
