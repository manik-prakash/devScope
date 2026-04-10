/**
 * src/config/prisma.ts
 *
 * Singleton PrismaClient. Re-used across the process lifetime.
 * In development, the instance is cached on `globalThis` to survive
 * hot-module reloads from tsx watch without exhausting connection pools.
 */

import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

// ---------------------------------------------------------------------------
// Singleton setup
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
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
