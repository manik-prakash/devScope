import { describe, it, expect, vi } from 'vitest';
import { deleteOrg, createUser } from '../controllers/admin.js';
import { mockReq, mockRes } from './helpers/http.js';

function buildReq(body: unknown, orgDelete = vi.fn().mockResolvedValue({})) {
  return {
    req: mockReq({
      body,
      user: { userId: 'adm-1', orgId: 'org-acme', role: 'ADMIN' },
      prisma: {
        organization: {
          findUnique: vi.fn().mockResolvedValue({ id: 'org-acme', slug: 'acme' }),
          delete: orgDelete,
        },
      },
    }),
    orgDelete,
  };
}

describe('deleteOrg', () => {
  it('400s when the confirm string does not match the org slug', async () => {
    const { req, orgDelete } = buildReq({ confirm: 'not-acme' });

    await expect(deleteOrg(req, mockRes())).rejects.toMatchObject({ statusCode: 400 });
    expect(orgDelete).not.toHaveBeenCalled();
  });

  it('rejects (schema) when confirm is missing — global handler maps ZodError → 400', async () => {
    const { req, orgDelete } = buildReq({});
    await expect(deleteOrg(req, mockRes())).rejects.toMatchObject({ name: 'ZodError' });
    expect(orgDelete).not.toHaveBeenCalled();
  });

  it('deletes the caller’s org when the confirm string matches', async () => {
    const { req, orgDelete } = buildReq({ confirm: 'acme' });
    const res = mockRes();

    await deleteOrg(req, res);

    expect(orgDelete).toHaveBeenCalledWith({ where: { id: 'org-acme' } });
    expect(res.statusCode).toBe(204);
  });
});

describe('createUser — seat enforcement', () => {
  function req(seats: number, userCount: number, create = vi.fn()) {
    return mockReq({
      body: { name: 'New Mgr', email: 'mgr@acme.com', role: 'MANAGER' },
      user: { userId: 'adm-1', orgId: 'org-acme', role: 'ADMIN' },
      prisma: {
        organization: { findUnique: vi.fn().mockResolvedValue({ seats }) },
        user: { count: vi.fn().mockResolvedValue(userCount), create },
      },
    });
  }

  it('403s when the org is already at its seat limit', async () => {
    const create = vi.fn();
    await expect(createUser(req(5, 5, create), mockRes())).rejects.toMatchObject({ statusCode: 403 });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the user when a seat is free', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'u9', name: 'New Mgr', email: 'mgr@acme.com', role: 'MANAGER' });
    const res = mockRes();
    await createUser(req(5, 4, create), res);
    expect(create).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });
});
