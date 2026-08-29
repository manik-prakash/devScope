import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany, updateMany } = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn() }));

vi.mock('../services/evaluator/index.js', () => ({
  evaluatePipeline: vi.fn().mockResolvedValue(undefined),
}));
import { evaluatePipeline } from '../services/evaluator/index.js';
import { reconcileStuckEvaluations } from '../services/evaluator/reconcile.js';

const evalMock = vi.mocked(evaluatePipeline);
const prisma = { session: { findMany, updateMany } } as unknown as Parameters<typeof reconcileStuckEvaluations>[0];

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  updateMany.mockResolvedValue({ count: 1 }); // default: this instance wins the claim
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

  it('claims each row atomically and dispatches only the ones it won', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    // This instance wins 'a'; another instance already claimed 'b'.
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const n = await reconcileStuckEvaluations(prisma);

    expect(n).toBe(1);
    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(evalMock).toHaveBeenCalledWith('a');
    expect(evalMock).not.toHaveBeenCalledWith('b');

    const claim = updateMany.mock.calls[0][0];
    expect(claim.where.id).toBe('a');
    expect(claim.where.evaluationStatus).toBe('PENDING');
    expect(claim.data.evaluatedAt).toBeInstanceOf(Date);
  });

  it('also re-selects rows whose earlier claim went stale', async () => {
    findMany.mockResolvedValue([]);
    await reconcileStuckEvaluations(prisma);

    const or = findMany.mock.calls[0][0].where.OR;
    expect(or).toEqual(
      expect.arrayContaining([
        { evaluatedAt: null },
        expect.objectContaining({ evaluatedAt: expect.objectContaining({ lt: expect.any(Date) }) }),
      ]),
    );
  });
});
