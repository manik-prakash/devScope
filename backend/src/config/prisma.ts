/**
 * src/config/prisma.ts
 *
 * Singleton PrismaClient. Re-used across the process lifetime.
 * In development, the instance is cached on `globalThis` to survive
 * hot-module reloads from tsx watch without exhausting connection pools.
 *
 * Prisma 7 requires a driver adapter — PrismaPg connects directly to the
 * Postgres server using the same DATABASE_URL exposed via env.ts.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from './env.js'

// ---------------------------------------------------------------------------
// Singleton setup
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  })
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
