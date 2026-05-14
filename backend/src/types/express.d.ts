/**
 * src/types/express.d.ts
 *
 * Augments Express.Request with DevScope-specific properties injected
 * by auth middleware. TypeScript enforces correct usage across all routes.
 *
 * Middleware contracts:
 *   requireJwt   → sets req.user  (type: 'jwt')
 *   requireApiKey → sets req.user (type: 'apikey') and req.apiKey
 */

import type { PrismaClient } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      /**
       * Prisma client attached by src/middleware/prismaMiddleware.ts.
       * Available on every request.
       */
      prisma: PrismaClient

      /**
       * Authenticated user context.
       * Set by requireJwt or requireApiKey middleware.
       * Undefined on public routes.
       */
      user?: {
        userId: string
        orgId: string
        role: 'ADMIN' | 'MANAGER' | 'DEVELOPER'
        /** Distinguishes JWT (dashboard) from API key (CLI) auth */
        type: 'jwt' | 'apikey'
      }

      /**
       * Resolved API key record.
       * Only set by requireApiKey middleware — not present on JWT routes.
       */
      apiKey?: {
        id: string
        userId: string
        orgId: string
        signingSecret: string
      }
    }
  }
}

export {}
