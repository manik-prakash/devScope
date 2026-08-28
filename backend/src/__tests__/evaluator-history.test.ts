import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../config/prisma.js', () => ({ prisma: { sessionScore: { findMany } } }));

import { loadHistory } from '../services/evaluator/index.js';

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe('loadHistory', () => {
  it('excludes failed evaluations from a developer trend history', async () => {
    await loadHistory('user-1', 'session-current');

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      userId: 'user-1',
      evaluationFailed: false,
      sessionId: { not: 'session-current' },
    });
  });
});
