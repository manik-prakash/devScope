import { describe, it, expect, vi } from 'vitest';
import { deleteOrg } from '../controllers/admin.js';
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
