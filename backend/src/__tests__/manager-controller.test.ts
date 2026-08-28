import { describe, it, expect, vi } from 'vitest';
import { getUserById } from '../controllers/manager.js';
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
