import { z } from 'zod'

export const RealmPackageSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/, 'Package name must be lowercase alphanumeric with hyphens'),
  version: z
    .string()
    .regex(/^\d{4}\.\d{1,2}\.\d{1,2}$/, 'Version must be CalVer YYYY.M.D'),
  description: z.string().max(500).default(''),
  author: z.string().max(128).default(''),
  realm: z.string().min(1).describe('Target realm type'),
  skills: z.array(z.string()).default([]),
  dependencies: z.record(z.string()).default({}),
  engine: z.string().default('>=22'),
})

export type RealmPackage = z.infer<typeof RealmPackageSchema>

export const PublishRequestSchema = z.object({
  manifest: RealmPackageSchema,
  // tarball is handled separately (base64 in JSON body or multipart)
})

export type PublishRequest = z.infer<typeof PublishRequestSchema>
