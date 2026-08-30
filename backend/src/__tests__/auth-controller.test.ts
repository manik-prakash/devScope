import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { loginSchema } from '../validators/auth.js';
import { login, register, refresh, logout } from '../controllers/auth.js';
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

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

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
          findFirst: vi.fn(),
          findUnique: vi.fn(),
        },
        refreshToken: { create: vi.fn().mockResolvedValue({}) },
        ...prismaOverrides,
      },
    });
  }

  // Factory, not a constant — HASH is only set in beforeAll, after the describe body runs.
  const acmeUser = () => ({
    id: 'u-acme', orgId: 'org-acme', role: 'DEVELOPER',
    passwordHash: HASH, mustChangePass: false, name: 'Ada Lovelace', email: 'ada@acme.com',
  });

  it('rejects login when the org slug is unknown', async () => {
    const req = reqWith({
      organization: { findUnique: vi.fn().mockResolvedValue(null) },
      user: {
        findFirst: vi.fn().mockResolvedValue({ ...acmeUser(), id: 'u-other', orgId: 'org-other' }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(login(req, mockRes())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('authenticates the user in the named org, not another org with the same email', async () => {
    const req = reqWith({
      user: {
        findFirst: vi.fn().mockResolvedValue({ ...acmeUser(), id: 'u-other', orgId: 'org-other' }),
        findUnique: vi.fn((args: { where: { orgId_email: { orgId: string } } }) =>
          Promise.resolve(args.where.orgId_email.orgId === 'org-acme' ? acmeUser() : null),
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
      { user: { findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(acmeUser()) } },
      { orgSlug: 'acme', email: 'ada@acme.com', password: 'wrong-password' },
    );

    await expect(login(req, mockRes())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('includes user { name, email } in the response', async () => {
    const req = reqWith({ user: { findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(acmeUser()) } });
    const res = mockRes();

    await login(req, res);

    expect((res.body as { user: unknown }).user).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
    });
  });

  it('sets an httpOnly ds_refresh cookie and keeps the refresh token out of the JSON body', async () => {
    const req = reqWith({ user: { findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(acmeUser()) } });
    const res = mockRes();

    await login(req, res);

    const c = res.cookies.find((x) => x.name === 'ds_refresh');
    expect(c).toBeDefined();
    expect(c!.options.httpOnly).toBe(true);
    expect(c!.options.sameSite).toBe('lax');
    expect(typeof c!.value).toBe('string');
    expect(c!.value.length).toBeGreaterThan(20);

    const body = res.body as Record<string, unknown>;
    expect(body.refreshToken).toBeUndefined();
    expect(body.refreshExpiresAt).toBeUndefined();
    expect(typeof body.accessToken).toBe('string');
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

  it('includes user { name, email } and sets the refresh cookie', async () => {
    const req = reqWith(vi.fn().mockResolvedValue({
      id: 'u-acme', name: 'Ada Lovelace', email: 'ada@acme.com',
      orgId: 'org-acme', role: 'ADMIN',
    }));
    const res = mockRes();

    await register(req, res);

    expect((res.body as { user: unknown }).user).toEqual({ name: 'Ada Lovelace', email: 'ada@acme.com' });
    expect(res.cookies.some((c) => c.name === 'ds_refresh' && c.options.httpOnly === true)).toBe(true);
    expect((res.body as Record<string, unknown>).refreshToken).toBeUndefined();
  });

  it('returns 409 when a concurrent registration wins the slug race (P2002)', async () => {
    const req = reqWith(vi.fn().mockRejectedValue(P2002));
    await expect(register(req, mockRes())).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─── refresh ────────────────────────────────────────────────────────────────

describe('refresh', () => {
  const userRow = {
    orgId: 'org-acme', role: 'DEVELOPER', mustChangePass: false,
    name: 'Ada Lovelace', email: 'ada@acme.com',
  };

  function reqWith(
    storedToken: unknown,
    {
      rotateCount = 1,
      spentReadback,
      extra = {},
    }: {
      rotateCount?: number;
      spentReadback?: unknown;
      extra?: Record<string, unknown>;
    } = {},
  ) {
    // `refresh` re-reads the token on the lost-race path to pick up the successor
    // link the winner just set; `spentReadback` is that second read.
    const findUnique =
      spentReadback === undefined
        ? vi.fn().mockResolvedValue(storedToken)
        : vi.fn().mockResolvedValueOnce(storedToken).mockResolvedValue(spentReadback);

    return mockReq({
      cookies: { ds_refresh: 'the-raw-token' },
      prisma: {
        refreshToken: {
          findUnique,
          create: vi.fn().mockResolvedValue({}),
          // family revoke (reuse / outside-grace path)
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
        // interactive form: run the callback with a tx client whose conditional
        // revoke reports `rotateCount` rows touched (0 = this request lost the race).
        $transaction: vi.fn().mockImplementation((cb: (tx: unknown) => unknown) =>
          cb({
            refreshToken: {
              updateMany: vi.fn().mockResolvedValue({ count: rotateCount }),
              create: vi.fn().mockResolvedValue({}),
            },
          }),
        ),
        ...extra,
      },
    });
  }

  it('rotates the token: revokes the presented one, sets a new cookie, no refresh token in body', async () => {
    const req = reqWith({
      tokenHash: sha256('the-raw-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: 'u-acme',
      user: userRow,
    });
    const res = mockRes();

    await refresh(req, res);

    const tx = (req.prisma as { $transaction: ReturnType<typeof vi.fn> }).$transaction;
    expect(tx).toHaveBeenCalledTimes(1);

    const c = res.cookies.find((x) => x.name === 'ds_refresh');
    expect(c).toBeDefined();
    expect(c!.options.httpOnly).toBe(true);
    expect(c!.value).not.toBe('the-raw-token'); // a fresh token

    const body = res.body as Record<string, unknown>;
    expect(body.refreshToken).toBeUndefined();
    expect(typeof body.accessToken).toBe('string');
    expect((body.user as { email: string }).email).toBe('ada@acme.com');
  });

  it('detects reuse of a spent token: revokes the whole family, clears the cookie, 401', async () => {
    const req = reqWith({
      tokenHash: sha256('the-raw-token'),
      revokedAt: new Date(Date.now() - 60_000), // revoked well outside the rotation grace window
      replacedByTokenHash: 'successor-hash',    // rotated, but too long ago — treat as replay
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: 'u-acme',
      user: userRow,
    });
    const res = mockRes();

    await expect(refresh(req, res)).rejects.toMatchObject({ statusCode: 401 });

    const rt = (req.prisma as { refreshToken: { updateMany: ReturnType<typeof vi.fn> } }).refreshToken;
    expect(rt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-acme' }) }),
    );
    expect(res.clearedCookies.some((c) => c.name === 'ds_refresh')).toBe(true);
  });

  it('a token rotated moments ago (replacedByTokenHash set, within grace) → 200 + access token, family untouched', async () => {
    const req = reqWith({
      tokenHash: sha256('the-raw-token'),
      revokedAt: new Date(Date.now() - 500), // a sibling tab rotated it moments ago
      replacedByTokenHash: 'successor-hash',
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: 'u-acme',
      user: userRow,
    });
    const res = mockRes();

    await refresh(req, res);

    expect(typeof (res.body as Record<string, unknown>).accessToken).toBe('string');
    expect(res.cookies.some((c) => c.name === 'ds_refresh')).toBe(false); // cookie left alone
    expect(res.clearedCookies).toHaveLength(0);
    const rt = (req.prisma as { refreshToken: { updateMany: ReturnType<typeof vi.fn> } }).refreshToken;
    expect(rt.updateMany).not.toHaveBeenCalled(); // no family revoke
  });

  it('a straggler whose chain rotated again within grace (its successor is already dead) is still benign → 200, no family revoke', async () => {
    // Finding 1: three tabs share T0. Tab A rotates T0→T1; another tab rotates
    // T1→T2. A slow first-race loser then re-presents T0 — still inside the grace
    // window, replacedByTokenHash set, but T1 (its immediate successor) is gone.
    // This must NOT nuke the family / the live T2.
    const req = reqWith({
      tokenHash: sha256('the-raw-token'),
      revokedAt: new Date(Date.now() - 2_000), // rotated ~2s ago — well inside grace
      replacedByTokenHash: 'successor-hash',   // it WAS rotated (not a logout revoke);
      expiresAt: new Date(Date.now() + 86_400_000), // the successor itself may be long gone
      userId: 'u-acme',
      user: userRow,
    });
    const res = mockRes();

    await refresh(req, res);

    expect(typeof (res.body as Record<string, unknown>).accessToken).toBe('string');
    expect(res.cookies.some((c) => c.name === 'ds_refresh')).toBe(false);
    expect(res.clearedCookies).toHaveLength(0);
    const rt = (req.prisma as { refreshToken: { updateMany: ReturnType<typeof vi.fn> } }).refreshToken;
    expect(rt.updateMany).not.toHaveBeenCalled();
  });

  it('a token killed by logout / change-password (replacedByTokenHash null), even within grace → 401', async () => {
    // A null successor link means the token was bulk-revoked, not rotated — that
    // is always a hard stop, grace window or not.
    const req = reqWith({
      tokenHash: sha256('the-raw-token'),
      revokedAt: new Date(Date.now() - 500), // just now, but…
      replacedByTokenHash: null,             // …no rotation link → not a concurrent refresh
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: 'u-acme',
      user: userRow,
    });
    const res = mockRes();

    await expect(refresh(req, res)).rejects.toMatchObject({ statusCode: 401 });
    const rt = (req.prisma as { refreshToken: { updateMany: ReturnType<typeof vi.fn> } }).refreshToken;
    expect(rt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-acme' }) }),
    );
  });

  it('a lost rotation race, re-read shows it was rotated within grace → 200 + access token, cookie & family untouched', async () => {
    const req = reqWith(
      {
        tokenHash: sha256('the-raw-token'),
        revokedAt: null, // still active at our findUnique
        expiresAt: new Date(Date.now() + 86_400_000),
        userId: 'u-acme',
        user: userRow,
      },
      {
        rotateCount: 0, // lost the conditional revoke
        spentReadback: {
          replacedByTokenHash: 'successor-hash',
          revokedAt: new Date(Date.now() - 200), // the winner revoked it moments ago
        },
      },
    );
    const res = mockRes();

    await refresh(req, res);

    expect(typeof (res.body as Record<string, unknown>).accessToken).toBe('string');
    expect(res.cookies.some((c) => c.name === 'ds_refresh')).toBe(false);
    expect(res.clearedCookies).toHaveLength(0);
    const rt = (req.prisma as { refreshToken: { updateMany: ReturnType<typeof vi.fn> } }).refreshToken;
    expect(rt.updateMany).not.toHaveBeenCalled();
  });

  it('a lost rotation race where the re-read shows a logout revoke (no rotation link) → 401 + family revoke', async () => {
    const req = reqWith(
      {
        tokenHash: sha256('the-raw-token'),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        userId: 'u-acme',
        user: userRow,
      },
      {
        rotateCount: 0,
        spentReadback: { replacedByTokenHash: null, revokedAt: new Date(Date.now() - 200) },
      },
    );
    const res = mockRes();

    await expect(refresh(req, res)).rejects.toMatchObject({ statusCode: 401 });

    const rt = (req.prisma as { refreshToken: { updateMany: ReturnType<typeof vi.fn> } }).refreshToken;
    expect(rt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u-acme', revokedAt: null }) }),
    );
    expect(res.clearedCookies.some((c) => c.name === 'ds_refresh')).toBe(true);
  });

  it('401s when the token is unknown', async () => {
    const req = reqWith(null);
    await expect(refresh(req, mockRes())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('401s when there is no cookie and no body token', async () => {
    const req = mockReq({ cookies: {}, body: {}, prisma: { refreshToken: { findUnique: vi.fn() } } });
    await expect(refresh(req, mockRes())).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ─── logout ─────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('revokes the cookie token and clears the cookie', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const req = mockReq({
      cookies: { ds_refresh: 'tok' },
      user: { userId: 'u-acme' },
      prisma: { refreshToken: { updateMany } },
    });
    const res = mockRes();

    await logout(req, res);

    expect(updateMany).toHaveBeenCalled();
    expect(res.clearedCookies.some((c) => c.name === 'ds_refresh')).toBe(true);
    expect(res.statusCode).toBe(204);
  });
});
