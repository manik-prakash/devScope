/**
 * src/server.ts
 *
 * Application entry point.
 *
 * Order of operations:
 *   1. Validate environment variables (exits with clear error if invalid)
 *   2. Import the app factory (env must be validated first)
 *   3. Connect PrismaClient to verify DB is reachable at startup
 *   4. Bind to PORT and begin accepting requests
 *   5. Register graceful shutdown on SIGTERM / SIGINT
 */

import './config/env.js' // validates env — must be first import
import { createApp } from './app.js'
import { prisma } from './config/prisma.js'
import { logger } from './config/logger.js'
import { env } from './config/env.js'
import { reconcileStuckEvaluations } from './services/evaluator/reconcile.js'

// How often to sweep for sessions whose evaluation never finished (a crash
// between the 202 and the SessionScore write).
const RECONCILE_INTERVAL_MS = 10 * 60_000

// Last-resort safety net. With express-async-errors in place, handler rejections
// are routed to the error middleware; anything that still reaches here is a bug
// outside the request lifecycle. Log it rather than let Node exit silently.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection')
})
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException — exiting')
  process.exit(1)
})

async function main() {
  // ── Verify database connectivity before accepting traffic ────────────
  try {
    await prisma.$connect()
    logger.info('Database connected')
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to database. Exiting.')
    process.exit(1)
  }

  // ── Build app and start listening ────────────────────────────────────
  const app = createApp()

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `DevScope backend listening on :${env.PORT}`,
    )
  })

  // ── Durable evaluation recovery ─────────────────────────────────────
  // Re-dispatch any session left stuck in PENDING by a crash/restart, then
  // keep sweeping. `unref()` so the timer never blocks shutdown.
  const runReconcile = () =>
    void reconcileStuckEvaluations(prisma).catch((err) =>
      logger.error({ err }, 'reconcile sweep failed'),
    )
  runReconcile()
  const reconcileTimer = setInterval(runReconcile, RECONCILE_INTERVAL_MS)
  reconcileTimer.unref()

  // ── Graceful shutdown ────────────────────────────────────────────────
  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutdown signal received')
    clearInterval(reconcileTimer)

    server.close(async () => {
      logger.info('HTTP server closed')
      await prisma.$disconnect()
      logger.info('Database disconnected — bye!')
      process.exit(0)
    })

    // Force-exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err) => {
  logger.fatal({ err }, 'Unhandled error during startup')
  process.exit(1)
})
