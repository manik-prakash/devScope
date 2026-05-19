/**
 * Prisma 7 configuration.
 *
 * In Prisma 7 the connection URL is no longer declared inside schema.prisma —
 * it lives here and is consumed by both the Prisma CLI (migrate, generate,
 * studio) and any tooling that calls `prisma.config.ts`.
 *
 * The runtime PrismaClient receives its connection through the PrismaPg
 * driver adapter in src/config/prisma.ts; this file only configures the CLI.
 */

import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
