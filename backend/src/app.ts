/**
 * src/app.ts
 *
 * Builds and returns the configured Express application.
 * Does NOT start listening — that is handled by src/index.ts.
 * This separation keeps the app testable via supertest without binding ports.
 */

// Patches the Express 4 router so a rejected promise from an async handler or
// middleware is forwarded to the error handler below instead of becoming an
// unhandled rejection (which would crash the process). MUST be imported before
// any route/handler is defined.
import 'express-async-errors'

import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import helmet from 'helmet'
import cors from 'cors'

import { env, corsOrigins } from './config/env.js'
import { prismaMiddleware } from './middleware/prisma.js'
import { AppError } from './utils/errors.js'
import { logger } from './config/logger.js'

// Routes (mounted after all middleware is registered)
import v1Router from './routes/index.js'

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export function createApp(): Application {
  const app = express()

  // ── Security headers ───────────────────────────────────────────────────
  app.use(helmet())

  // ── CORS ──────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? corsOrigins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CLI-Version'],
    }),
  )

  // ── Body parsing ──────────────────────────────────────────────────────
  // 5 MB limit accommodates large session message logs from the CLI
  app.use(express.json({ limit: '5mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Database client ──────────────────────────────────────────────────
  app.use(prismaMiddleware)

  // ── Request logging (dev only) ────────────────────────────────────────
  if (env.NODE_ENV === 'development') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug({ method: req.method, url: req.url }, 'incoming request')
      next()
    })
  }

  // ── API routes ────────────────────────────────────────────────────────
  app.use('/api/v1', v1Router)

  // ── 404 handler ──────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
  })

  // ── Global error handler ──────────────────────────────────────────────
  // Must have 4 parameters so Express recognises it as an error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code })
      return
    }

    // Zod validation errors forwarded from routes
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ZodError'
    ) {
      type ZodIssue = { path: string[]; message: string }
      const zodErr = (err as unknown) as { errors: ZodIssue[] }
      const detail = zodErr.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      res.status(400).json({ error: `Validation failed: ${detail}`, code: 'VALIDATION_ERROR' })
      return
    }

    // Unknown / unhandled errors
    logger.error({ err }, 'unhandled error')
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  })

  return app
}
