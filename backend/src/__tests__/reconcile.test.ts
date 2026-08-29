import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('../services/evaluator/index.js', () => ({
  evaluatePipeline: vi.fn().mockResolvedValue(undefined),
}));
import { evaluatePipeline } from '../services/evaluator/index.js';
import { reconcileStuckEvaluations } from '../services/evaluator/reconcile.js';

const evalMock = vi.mocked(evaluatePipeline);
// Only .session.findMany is touched.
const prisma = { session: { findMany } } as unknown as Parameters<typeof reconcileStuckEvaluations>[0];

beforeEach(() => {
  findMany.mockReset();
  evalMock.mockReset();
  evalMock.mockResolvedValue(undefined);
});

describe('reconcileStuckEvaluations', () => {
  it('selects only stale PENDING signed sessions and dispatches each exactly once', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const n = await reconcileStuckEvaluations(prisma);

    expect(n).toBe(2);
    const where = findMany.mock.calls[0][0].where;
    expect(where.evaluationStatus).toBe('PENDING');
    expect(where.signatureValid).toBe(true);
    expect(where.createdAt.lt).toBeInstanceOf(Date);
    expect(where.createdAt.lt.getTime()).toBeLessThan(Date.now());

    expect(evalMock).toHaveBeenCalledTimes(2);
    expect(evalMock).toHaveBeenCalledWith('a');
    expect(evalMock).toHaveBeenCalledWith('b');
  });

  it('is a no-op when nothing is stuck', async () => {
    findMany.mockResolvedValue([]);

    expect(await reconcileStuckEvaluations(prisma)).toBe(0);
    expect(evalMock).not.toHaveBeenCalled();
  });

  it('caps the batch size', async () => {
    findMany.mockResolvedValue([]);
    await reconcileStuckEvaluations(prisma);
    expect(findMany.mock.calls[0][0].take).toBeLessThanOrEqual(25);
  });

  it('does not reject if a dispatched pipeline rejects', async () => {
    findMany.mockResolvedValue([{ id: 'x' }]);
    evalMock.mockRejectedValueOnce(new Error('boom'));

    await expect(reconcileStuckEvaluations(prisma)).resolves.toBe(1);
  });
});
