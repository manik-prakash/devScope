import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { loginSchema } from '../validators/auth.js';
import { login, register, refresh } from '../controllers/auth.js';
import { mockReq, mockRes } from './helpers/http.js';

const P2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
  code: 'P2002',
  clientVersion: 'test',
});

const PASSWORD = 'secret12';
let HASH = '';

beforeAll(async () => {
  HASH = await bcrypt.hash(PASSWORD, 10);
});

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('requires orgSlug', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: PASSWORD }).success).toBe(false);
    expect(
      loginSchema.safeParse({ orgSlug: 'acme', email: 'a@b.com', password: PASSWORD }).success,
    ).toBe(true);
  });
});

// ─── login ──────────────────────────────────────────────────────────────────

describe('login', () => {
  function reqWith(prismaOverrides: Record<string, unknown>, body?: Record<string, unknown>) {
    return mockReq({
      body: body ?? { orgSlug: 'acme', email: 'ada@acme.com', password: PASSWORD },
      prisma: {
        organization: { findUnique: vi.fn().mockResolvedValue({ id: 'org-acme', slug: 'acme' }) },
        user: {
          findFirst: vi.fn(), // legacy path — must not be used post-fix
          findUnique: vi.fn(),
        },
        refreshToken: { create: vi.fn().mockResolvedValue({}) },
        ...prismaOverrides,
      },
    });
  }

  it('rejects login when the org slug is unknown', async () => {
    const req = reqWith({
      organization: { findUnique: vi.fn().mockResolvedValue(null) },
      user: {
        // legacy findFirst would happily return a user by email alone
        findFirst: vi.fn().mockResolvedValue({
          id: 'u-other', orgId: 'org-other', role: 'DEVELOPER',
          passwordHash: HASH, mustChangePass: false, name: 'Ada', email: 'ada@acme.com',
        }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(login(req, mockRes())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('authenticates the user in the named org, not another org with the same email', async () => {
    const acmeUser = {
      id: 'u-acme', orgId: 'org-acme', role: 'DEVELOPER',
      passwordHash: HASH, mustChangePass: false, name: 'Ada', email: 'ada@acme.com',
    };
    const req = reqWith({
      user: {
        findFirst: vi.fn().mockResolvedValue({ ...acmeUser, id: 'u-other', orgId: 'org-other' }),
        findUnique: vi.fn((args: { where: { orgId_email: { orgId: string } } }) =>
          Promise.resolve(args.where.orgId_email.orgId === 'org-acme' ? acmeUser : null),
        ),
      },
    });
    const res = mockRes();

    await login(req, res);

    const decoded = jwt.verify((res.body as { accessToken: string }).accessToken, env.JWT_SECRET) as {
      sub: string; orgId: string;
    };
    expect(decoded).toMatchObject({ sub: 'u-acme', orgId: 'org-acme' });
  });

  it('rejects a wrong password with 401', async () => {
    const req = reqWith(
      {
        user: {
          findFirst: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            id: 'u-acme', orgId: 'org-acme', role: 'DEVELOPER',
            passwordHash: HASH, mustChangePass: false, name: 'Ada', email: 'ada@acme.com',
          }),
        },
      },
      { orgSlug: 'acme', email: 'ada@acme.com', password: 'wrong-password' },
    );

    await expect(login(req, mockRes())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('includes user { name, email } in the response', async () => {
    const acmeUser = {
      id: 'u-acme', orgId: 'org-acme', role: 'DEVELOPER',
      passwordHash: HASH, mustChangePass: false, name: 'Ada Lovelace', email: 'ada@acme.com',
    };
    const req = reqWith({
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(acmeUser),
      },
    });
    const res = mockRes();

    await login(req, res);

    expect((res.body as { user: unknown }).user).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    });
  });

  it('reports the refresh-token expiry so the browser cookie can match it', async () => {
    const req = reqWith({
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          id: 'u-acme', orgId: 'org-acme', role: 'DEVELOPER',
          passwordHash: HASH, mustChangePass: false, name: 'Ada', email: 'ada@acme.com',
        }),
      },
    });
    const res = mockRes();

    await login(req, res);

    const body = res.body as { refreshExpiresAt?: string };
    expect(typeof body.refreshExpiresAt).toBe('string');
    expect(Number.isNaN(Date.parse(body.refreshExpiresAt as string))).toBe(false);
    // ~7 days out by default, comfortably in the future.
    expect(Date.parse(body.refreshExpiresAt as string)).toBeGreaterThan(Date.now() + 86_400_000);
  });
});

// ─── register ───────────────────────────────────────────────────────────────

describe('register', () => {
  function reqWith(txImpl: unknown) {
    return mockReq({
      body: {
        orgName: 'Acme', orgSlug: 'acme', name: 'Ada Lovelace',
        email: 'ada@acme.com', password: PASSWORD,
      },
      prisma: {
        organization: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: txImpl,
        refreshToken: { create: vi.fn().mockResolvedValue({}) },
      },
    });
  }

  it('includes user { name, email } in the response', async () => {
    const req = reqWith(vi.fn().mockResolvedValue({
      id: 'u-acme', name: 'Ada Lovelace', email: 'ada@acme.com',
      orgId: 'org-acme', role: 'ADMIN',
    }));
    const res = mockRes();

    await register(req, res);

    expect((res.body as { user: unknown }).user).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    });
  });

  it('returns 409 when a concurrent registration wins the slug race (P2002)', async () => {
    const req = reqWith(vi.fn().mockRejectedValue(P2002));

    await expect(register(req, mockRes())).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─── refresh ────────────────────────────────────────────────────────────────

describe('refresh', () => {
  it('includes user { name, email } in the response', async () => {
    const raw = 'a-refresh-token';
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const req = mockReq({
      body: { refreshToken: raw },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue({
            tokenHash,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86_400_000),
            userId: 'u-acme',
            user: {
              orgId: 'org-acme', role: 'DEVELOPER', mustChangePass: false,
              name: 'Ada Lovelace', email: 'ada@acme.com',
            },
          }),
        },
      },
    });
    const res = mockRes();

    await refresh(req, res);

    expect((res.body as { user: unknown }).user).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    });
  });
});
