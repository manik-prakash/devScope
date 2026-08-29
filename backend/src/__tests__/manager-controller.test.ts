import { describe, it, expect, vi } from 'vitest';
import { getUserById, getSessions, getSessionById, addProjectMember } from '../controllers/manager.js';
import { mockReq, mockRes } from './helpers/http.js';

describe('getUserById', () => {
  const user = {
    id: 'u-1', email: 'ada@acme.com', name: 'Ada', role: 'DEVELOPER',
    mustChangePass: false, createdAt: new Date(),
  };

  it('returns a user scoped to the caller org', async () => {
    const findFirst = vi.fn().mockResolvedValue(user);
    const req = mockReq({
      params: { userId: 'u-1' },
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: { user: { findFirst } },
    });
    const res = mockRes();

    await getUserById(req, res);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1', orgId: 'org-acme' } }),
    );
    expect((res.body as { user: unknown }).user).toEqual(user);
  });

  it('404s when the user is not in the caller org', async () => {
    const req = mockReq({
      params: { userId: 'u-x' },
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: { user: { findFirst: vi.fn().mockResolvedValue(null) } },
    });

    await expect(getUserById(req, mockRes())).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('getSessions — project scoping', () => {
  const rows = [{ id: 's1', orgId: 'org-acme', projectId: 'p1', durationMs: 5n }];
  const memberScoped = { orgId: 'org-acme', project: { members: { some: { userId: 'mgr-1' } } } };

  it('restricts a manager to sessions in projects they belong to', async () => {
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(1);
    const req = mockReq({
      query: {},
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: { session: { findMany, count } },
    });

    await getSessions(req, mockRes());

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: memberScoped }));
    expect(count).toHaveBeenCalledWith({ where: memberScoped });
  });

  it('clamps hostile pagination params (no negative skip, take capped at the session-list max)', async () => {
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(1);
    const req = mockReq({
      query: { page: '-3', limit: '99999' },
      user: { userId: 'adm-1', orgId: 'org-acme', role: 'ADMIN' },
      prisma: { session: { findMany, count } },
    });

    await getSessions(req, mockRes());

    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBeGreaterThanOrEqual(0);
    expect(args.take).toBe(500);
  });

  it('lets an admin see every session in the org', async () => {
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(1);
    const req = mockReq({
      query: {},
      user: { userId: 'adm-1', orgId: 'org-acme', role: 'ADMIN' },
      prisma: { session: { findMany, count } },
    });

    await getSessions(req, mockRes());

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: 'org-acme' } }));
    expect(count).toHaveBeenCalledWith({ where: { orgId: 'org-acme' } });
  });
});

describe('getSessionById — project scoping', () => {
  const session = { id: 's1', orgId: 'org-acme', projectId: 'p1', durationMs: 5n, user: {}, project: {} };

  it('404s for a manager not a member of the session’s project', async () => {
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: {
        session: { findUnique: vi.fn().mockResolvedValue(session) },
        projectMember: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    });

    await expect(getSessionById(req, mockRes())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns the session for a manager who is a project member', async () => {
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: {
        session: { findUnique: vi.fn().mockResolvedValue(session) },
        projectMember: { findUnique: vi.fn().mockResolvedValue({ projectId: 'p1', userId: 'mgr-1' }) },
      },
    });
    const res = mockRes();

    await getSessionById(req, res);

    expect((res.body as { id: string }).id).toBe('s1');
  });

  it('includes the real evaluator dimensions (scoreDetail) in the query', async () => {
    const findUnique = vi.fn().mockResolvedValue(session);
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'adm-1', orgId: 'org-acme', role: 'ADMIN' },
      prisma: {
        session: { findUnique },
        projectMember: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    });

    await getSessionById(req, mockRes());

    const include = findUnique.mock.calls[0][0].include;
    expect(include.scoreDetail).toBeDefined();
    expect(include.scoreDetail.select).toMatchObject({
      promptQuality: true,
      iterationEfficiency: true,
      toolUtilization: true,
    });
  });

  it('returns the session for an admin without a membership check', async () => {
    const pmFind = vi.fn().mockResolvedValue(null);
    const req = mockReq({
      params: { sessionId: 's1' },
      user: { userId: 'adm-1', orgId: 'org-acme', role: 'ADMIN' },
      prisma: {
        session: { findUnique: vi.fn().mockResolvedValue(session) },
        projectMember: { findUnique: pmFind },
      },
    });
    const res = mockRes();

    await getSessionById(req, res);

    expect((res.body as { id: string }).id).toBe('s1');
    expect(pmFind).not.toHaveBeenCalled();
  });
});

describe('addProjectMember — seat enforcement (new user)', () => {
  function req(seats: number, userCount: number, tx = vi.fn()) {
    return mockReq({
      params: { projectId: 'p1' },
      body: { name: 'Dev', email: 'dev@acme.com' },
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: {
        project: {
          findFirst: vi.fn().mockResolvedValue({ id: 'p1', orgId: 'org-acme', members: [{ userId: 'mgr-1' }] }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(null), // no existing org user -> fresh-user branch
          count: vi.fn().mockResolvedValue(userCount),
        },
        organization: { findUnique: vi.fn().mockResolvedValue({ seats }) },
        $transaction: tx,
      },
    });
  }

  it('403s when the org is at its seat limit', async () => {
    const tx = vi.fn();
    await expect(addProjectMember(req(5, 5, tx), mockRes())).rejects.toMatchObject({ statusCode: 403 });
    expect(tx).not.toHaveBeenCalled();
  });

  it('proceeds to create when a seat is free', async () => {
    const tx = vi.fn().mockResolvedValue({ id: 'u9', name: 'Dev', email: 'dev@acme.com', role: 'DEVELOPER' });
    const res = mockRes();
    await addProjectMember(req(5, 4, tx), res);
    expect(tx).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('does NOT seat-check when adding an existing org member', async () => {
    const count = vi.fn().mockResolvedValue(5); // at limit, but must be ignored
    const r = mockReq({
      params: { projectId: 'p1' },
      body: { name: 'Dev', email: 'dev@acme.com' },
      user: { userId: 'mgr-1', orgId: 'org-acme', role: 'MANAGER' },
      prisma: {
        project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', orgId: 'org-acme', members: [{ userId: 'mgr-1' }] }) },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'u-existing', name: 'Dev', email: 'dev@acme.com', role: 'DEVELOPER' }),
          count,
        },
        organization: { findUnique: vi.fn().mockResolvedValue({ seats: 5 }) },
        projectMember: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
        },
      },
    });
    const res = mockRes();
    await addProjectMember(r, res);
    expect(res.statusCode).toBe(201);
    expect(count).not.toHaveBeenCalled();
  });
});
