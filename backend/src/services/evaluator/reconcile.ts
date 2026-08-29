import type { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger.js';
import { evaluatePipeline } from './index.js';

// A session still PENDING this long after ingest never finished evaluating —
// the pipeline dies well inside 2 minutes (15s LLM timeout x a few stages), so
// 10 minutes is comfortably past any legitimately in-flight run.
const STALE_AFTER_MS = 10 * 60_000;

// Bound the work per sweep so a large backlog drains gradually instead of
// firing hundreds of LLM pipelines at once.
const MAX_BATCH = 25;

/**
 * Re-dispatch evaluation for sessions that were ingested with a valid signature
 * but whose pipeline never reached a terminal state (a process crash/restart
 * between the 202 and the SessionScore write). `evaluatePipeline` never throws
 * and its persist step is an upsert, so a rare double-run is harmless.
 *
 * Returns the number of sessions re-dispatched.
 */
export async function reconcileStuckEvaluations(
  prisma: Pick<PrismaClient, 'session'>,
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const stuck = await prisma.session.findMany({
    where: {
      evaluationStatus: 'PENDING',
      signatureValid: true,
      createdAt: { lt: cutoff },
      evaluatedAt: null,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_BATCH,
  });

  if (stuck.length === 0) return 0;

  logger.warn({ count: stuck.length }, 'reconcile: re-dispatching stuck PENDING evaluations');

  for (const { id } of stuck) {
    void evaluatePipeline(id).catch((err) =>
      logger.error({ err, sessionId: id }, 'reconcile: evaluatePipeline rejected'),
    );
  }

  return stuck.length;
}
