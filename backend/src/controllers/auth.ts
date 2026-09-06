import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { env } from '../config/env.js';
import { unauthorized, conflict } from '../utils/errors.js';
import { loginSchema, changePasswordSchema, registerSchema } from '../validators/auth.js';
import { parseDuration } from '../utils/duration.js';

const REFRESH_TTL_MS = parseDuration(env.REFRESH_EXPIRES_IN) ?? 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'ds_refresh';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * `ds_refresh` is HttpOnly (JS can't read it — an XSS payload can't exfiltrate
 * it) and lives only in the cookie: it is never returned in a JSON body. When
 * the Next.js rewrite fronts the API, `/api/v1/*` is same-origin and
 * `SameSite=Lax` is enough. When `CROSS_SITE_COOKIES` is set (the frontend
 * calls this origin directly, no same-origin proxy in front), the cookie must
 * be `SameSite=None; Secure` instead to ride a cross-site request at all.
 */
function setRefreshCookie(res: Response, rawToken: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, rawToken, {
    httpOnly: true,
    secure: env.CROSS_SITE_COOKIES || env.NODE_ENV === 'production',
    sameSite: env.CROSS_SITE_COOKIES ? 'none' : 'lax',
    path: '/',
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

// The "leeway" window of refresh-token reuse detection. A token that was revoked
// *by rotation* and re-presented within this window is a concurrent refresh
// (browser waking with several tabs, a mobile retry) — not a replay. 30s matches
// the Okta / Auth0 default; larger cuts false logouts on slow networks, smaller
// tightens the replay window.
const ROTATION_GRACE_MS = 30_000;

// Revoke every still-active refresh token for a user — the reuse-detection
// response to a genuine replay.
async function revokeTokenFamily(
  prisma: Pick<PrismaClient, 'refreshToken'>,
  userId: string,
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// A spent token is a benign concurrent refresh (not a replay) iff it was revoked
// *by rotation* — `replacedByTokenHash` is set — within the grace window. We do
// NOT check whether that successor is still live: the chain may have rotated
// again in the same window (T0→T1→T2), and a straggler still holding T0 is just
// as benign as one holding T1. `replacedByTokenHash === null` means the token was
// killed by logout / change-password, which is always a hard stop. This matches
// how Okta / Auth0 / better-auth reconcile a grace period with reuse detection.
function isConcurrentRefresh(
  revokedAt: Date | null | undefined,
  replacedByTokenHash: string | null | undefined,
): boolean {
  if (!revokedAt || !replacedByTokenHash) return false;
  return Date.now() - revokedAt.getTime() < ROTATION_GRACE_MS;
}

function signAccessToken(user: Pick<User, 'id' | 'orgId' | 'role'>): string {
  const signOptions: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role }, env.JWT_SECRET, signOptions);
}

function newRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(40).toString('hex');
  return { raw, hash: sha256(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) };
}

interface IssuedTokens {
  accessToken: string;
  expiresIn: string;
  refreshRaw: string;
  refreshExpiresAt: Date;
}

async function issueTokens(user: Pick<User, 'id' | 'orgId' | 'role'>, prisma: PrismaClient): Promise<IssuedTokens> {
  const accessToken = signAccessToken(user);

  const { raw, hash, expiresAt } = newRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });

  return { accessToken, expiresIn: env.JWT_EXPIRES_IN, refreshRaw: raw, refreshExpiresAt: expiresAt };
}

// Body shape returned to the browser — no refresh token, that's the cookie's job.
function authBody(accessToken: string, expiresIn: string, user: Pick<User, 'name' | 'email'>, mustChangePass: boolean) {
  return { accessToken, expiresIn, mustChangePass, user: { name: user.name, email: user.email } };
}

export const login = async (req: Request, res: Response) => {
  const { orgSlug, email, password } = loginSchema.parse(req.body);

  // Email is only unique per organisation, so login must be scoped to one org.
  const org = await req.prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    throw unauthorized('Invalid organization, email, or password');
  }

  const user = await req.prisma.user.findUnique({
    where: { orgId_email: { orgId: org.id, email } },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid organization, email, or password');
  }

  const t = await issueTokens(user, req.prisma);
  setRefreshCookie(res, t.refreshRaw, t.refreshExpiresAt);
  res.json(authBody(t.accessToken, t.expiresIn, user, user.mustChangePass));
};

export const refresh = async (req: Request, res: Response) => {
  // Cookie is authoritative; a body token is still accepted (tests / non-browser).
  const raw = req.cookies?.[REFRESH_COOKIE] || (req.body?.refreshToken as string | undefined);
  if (!raw) throw unauthorized('Invalid or expired refresh token');

  const tokenHash = sha256(raw);
  const stored = await req.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw unauthorized('Invalid or expired refresh token');
  }

  // A spent token: distinguish a genuine replay from a concurrent refresh
  // (another tab rotated it moments ago). The latter gets a fresh access token
  // but no rotation — the sibling response already set the live `ds_refresh` in
  // the shared cookie jar. Note: a non-cookie caller (a body `refreshToken`, i.e.
  // tests) that races itself lands here and gets an access token but no refreshed
  // credential; only the cookie flow is supported for concurrent refresh.
  const grantConcurrentRefresh = () => {
    res.json(
      authBody(signAccessToken(stored.user), env.JWT_EXPIRES_IN, stored.user, stored.user.mustChangePass),
    );
  };

  if (stored.revokedAt) {
    if (isConcurrentRefresh(stored.revokedAt, stored.replacedByTokenHash)) {
      grantConcurrentRefresh();
      return;
    }
    // Genuine replay (revoked outside the grace window, or killed by logout /
    // change-password) — assume theft and revoke the whole family.
    await revokeTokenFamily(req.prisma, stored.userId);
    clearRefreshCookie(res);
    throw unauthorized('Refresh token reuse detected — please sign in again');
  }

  // Rotate atomically: revoke the presented token *only if it is still active*
  // (`revokedAt: null` in the WHERE), then mint its replacement. Two concurrent
  // refreshes with the same cookie both reach here; Postgres re-checks the WHERE
  // under the row lock so exactly one gets `count === 1`.
  const next = newRefreshToken();
  const rotated = await req.prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), replacedByTokenHash: next.hash },
    });
    if (revoked.count === 0) return false;
    await tx.refreshToken.create({
      data: { userId: stored.userId, tokenHash: next.hash, expiresAt: next.expiresAt },
    });
    return true;
  });

  if (!rotated) {
    // Lost the conditional revoke: the token was spent between our findUnique
    // and our updateMany. Re-read its now-set successor link + revocation time —
    // it's the benign multi-tab case only if it was revoked by rotation inside
    // the grace window.
    const spent = await req.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { replacedByTokenHash: true, revokedAt: true },
    });
    if (isConcurrentRefresh(spent?.revokedAt, spent?.replacedByTokenHash)) {
      grantConcurrentRefresh();
      return;
    }
    await revokeTokenFamily(req.prisma, stored.userId);
    clearRefreshCookie(res);
    throw unauthorized('Refresh token reuse detected — please sign in again');
  }

  setRefreshCookie(res, next.raw, next.expiresAt);
  res.json(
    authBody(signAccessToken(stored.user), env.JWT_EXPIRES_IN, stored.user, stored.user.mustChangePass),
  );
};

export const logout = async (req: Request, res: Response) => {
  const raw = req.cookies?.[REFRESH_COOKIE] || (req.body?.refreshToken as string | undefined);
  if (raw) {
    await req.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(raw), userId: req.user!.userId },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
  res.status(204).end();
};

export const register = async (req: Request, res: Response) => {
  const { orgName, orgSlug, name, email, password } = registerSchema.parse(req.body);

  const slugTaken = await req.prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (slugTaken) throw conflict('Organization slug already taken', 'ORG_SLUG_TAKEN');

  const passwordHash = await bcrypt.hash(password, 10);

  // Create org + admin user + backfill ownerId atomically. We use the interactive
  // form because the org.update needs the just-created user.id. The pre-check
  // above races a concurrent registration; the unique constraint is the real
  // guard, so translate its violation into the same 409 (like createProject).
  let user;
  try {
    user = await req.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug: orgSlug, plan: 'FREE', seats: 5 },
      });
      const created = await tx.user.create({
        data: {
          orgId: org.id,
          email,
          name,
          role: 'ADMIN',
          passwordHash,
          mustChangePass: false,
        },
      });
      await tx.organization.update({
        where: { id: org.id },
        data: { ownerId: created.id },
      });
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('Organization slug already taken', 'ORG_SLUG_TAKEN');
    }
    throw err;
  }

  const t = await issueTokens(user, req.prisma);
  setRefreshCookie(res, t.refreshRaw, t.refreshExpiresAt);
  res.status(201).json(authBody(t.accessToken, t.expiresIn, user, false));
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await req.prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw unauthorized('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await req.prisma.$transaction([
    req.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePass: false },
    }),
    req.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const t = await issueTokens(user, req.prisma);
  setRefreshCookie(res, t.refreshRaw, t.refreshExpiresAt);
  res.json(authBody(t.accessToken, t.expiresIn, user, false));
};
