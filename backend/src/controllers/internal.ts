import { type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { unauthorized, internal } from '../utils/errors.js'
import { reconcileStuckEvaluations } from '../services/evaluator/reconcile.js'
import { logger } from '../config/logger.js'

/**
 * Triggered by Vercel Cron (see vercel.json) in place of the setInterval sweep
 * in server.ts, which never fires on a serverless deployment. Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` automatically because the env var is
 * named exactly `CRON_SECRET` — nothing else should be able to call this.
 */
export const postReconcile = async (req: Request, res: Response) => {
  if (!env.CRON_SECRET) {
    throw internal('CRON_SECRET is not configured', 'CRON_NOT_CONFIGURED')
  }

  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    throw unauthorized('Invalid cron secret')
  }

  const claimed = await reconcileStuckEvaluations(req.prisma).catch((err) => {
    logger.error({ err }, 'internal/reconcile: sweep failed')
    throw internal('Reconcile sweep failed')
  })

  res.status(200).json({ claimed })
}
