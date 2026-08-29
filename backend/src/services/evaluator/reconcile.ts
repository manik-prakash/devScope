import type { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger.js';
import { evaluatePipeline } from './index.js';

// A session still PENDING this long after ingest never finished evaluating —
// the pipeline dies well inside 2 minutes (15s LLM timeout x a few stages), so
// 10 minutes is comfortably past any legitimately in-flight run.
const STALE_AFTER_MS = 10 * 60_000;

// A row this reconcile sweep claimed (by stamping `evaluatedAt`) but that never
// reached a terminal status becomes claimable again after this long — covers a
// crash between the claim and the SessionScore write.
const RECLAIM_AFTER_MS = 15 * 60_000;

// Bound the work per sweep so a large backlog drains gradually instead of
// firing hundreds of LLM pipelines at once.
const MAX_BATCH = 25;

/**
 * Re-dispatch evaluation for sessions ingested with a valid signature whose
 * pipeline never reached a terminal state (a crash/restart between the 202 and
 * the SessionScore write).
 *
 * Multi-instance safe: each candidate is *claimed* with a conditional
 * `updateMany` that stamps `evaluatedAt` only while the row is still PENDING and
 * unclaimed (or its previous claim has gone stale). Postgres re-checks the WHERE
 * under the row lock, so exactly one instance gets `count === 1` and dispatches;
 * the others get `count === 0` and skip. `evaluatePipeline`'s terminal write
 * sets a real `evaluatedAt` + non-PENDING status, so a finished row never
 * re-matches.
 *
 * Returns the number of sessions this instance claimed and re-dispatched.
 */
export async function reconcileStuckEvaluations(
  prisma: Pick<PrismaClient, 'session'>,
): Promise<number> {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_AFTER_MS);
  const reclaimCutoff = new Date(now - RECLAIM_AFTER_MS);

  const claimable = {
    OR: [{ evaluatedAt: null }, { evaluatedAt: { lt: reclaimCutoff } }],
  };

  const stuck = await prisma.session.findMany({
    where: {
      evaluationStatus: 'PENDING',
      signatureValid: true,
      createdAt: { lt: staleCutoff },
      ...claimable,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_BATCH,
  });

  if (stuck.length === 0) return 0;

  let claimed = 0;
  for (const { id } of stuck) {
    const res = await prisma.session.updateMany({
      where: { id, evaluationStatus: 'PENDING', ...claimable },
      data: { evaluatedAt: new Date() },
    });
    if (res.count !== 1) continue; // another instance claimed it first

    claimed++;
    void evaluatePipeline(id).catch((err) =>
      logger.error({ err, sessionId: id }, 'reconcile: evaluatePipeline rejected'),
    );
  }

  if (claimed > 0) {
    logger.warn({ count: claimed }, 'reconcile: re-dispatched stuck PENDING evaluations');
  }

  return claimed;
}
