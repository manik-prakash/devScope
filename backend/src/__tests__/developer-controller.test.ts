import { describe, it, expect, vi } from 'vitest';
import { getSessions, getSessionById } from '../controllers/developer.js';
import { mockReq, mockRes } from './helpers/http.js';

const DIMENSIONS = { promptQuality: true, iterationEfficiency: true, toolUtilization: true };

describe('developer.getSessionById', () => {
  const session = { id: 's1', userId: 'dev-1', projectId: 'p1', durationMs: 5n, project: {} };

  it('includes the real evaluator dimensions (scoreDetail) in the query', async () => {
    const findUnique = vi.fn().mockResolvedValue(session);
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'dev-1', orgId: 'org-acme', role: 'DEVELOPER' },
      prisma: { session: { findUnique } },
    });

    await getSessionById(req, mockRes());

    const include = findUnique.mock.calls[0][0].include;
    expect(include.scoreDetail).toBeDefined();
    expect(include.scoreDetail.select).toMatchObject(DIMENSIONS);
  });

  it('404s when the session belongs to another user', async () => {
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'someone-else', orgId: 'org-acme', role: 'DEVELOPER' },
      prisma: { session: { findUnique: vi.fn().mockResolvedValue(session) } },
    });

    await expect(getSessionById(req, mockRes())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns the session (durationMs serialized) for its owner', async () => {
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'dev-1', orgId: 'org-acme', role: 'DEVELOPER' },
      prisma: { session: { findUnique: vi.fn().mockResolvedValue(session) } },
    });
    const res = mockRes();

    await getSessionById(req, res);

    const body = res.body as { id: string; durationMs: string };
    expect(body.id).toBe('s1');
    expect(body.durationMs).toBe('5');
  });
});

describe('developer.getSessions', () => {
  it('includes scoreDetail in the list query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const req = mockReq({
      query: {},
      user: { userId: 'dev-1', orgId: 'org-acme', role: 'DEVELOPER' },
      prisma: {
        session: { findMany, count: vi.fn().mockResolvedValue(0) },
      },
    });

    await getSessions(req, mockRes());

    const include = findMany.mock.calls[0][0].include;
    expect(include.scoreDetail).toBeDefined();
    expect(include.scoreDetail.select).toMatchObject(DIMENSIONS);
  });
});
