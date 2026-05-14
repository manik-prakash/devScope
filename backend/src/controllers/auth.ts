import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { type PrismaClient, type User } from '@prisma/client';
import { env } from '../config/env.js';
import { unauthorized, conflict } from '../utils/errors.js';
import { loginSchema, refreshSchema, changePasswordSchema, registerSchema } from '../validators/auth.js';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

async function issueTokens(user: Pick<User, 'id' | 'orgId' | 'role'>, prisma: PrismaClient): Promise<IssuedTokens> {
  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as any,
  };

  const accessToken = jwt.sign(
    { sub: user.id, orgId: user.orgId, role: user.role },
    env.JWT_SECRET,
    signOptions
  );

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  const expiresAt = new Date();
  const days = parseInt(env.REFRESH_EXPIRES_IN) || 7;
  expiresAt.setDate(expiresAt.getDate() + days);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: env.JWT_EXPIRES_IN,
  };
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await req.prisma.user.findFirst({
    where: { email },
    include: { org: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }

  const tokens = await issueTokens(user, req.prisma);

  res.json({
    ...tokens,
    mustChangePass: user.mustChangePass,
  });
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const storedToken = await req.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw unauthorized('Invalid or expired refresh token');
  }

  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as any,
  };

  const accessToken = jwt.sign(
    { sub: storedToken.userId, orgId: storedToken.user.orgId, role: storedToken.user.role },
    env.JWT_SECRET,
    signOptions
  );

  res.json({
    accessToken,
    expiresIn: env.JWT_EXPIRES_IN,
    mustChangePass: storedToken.user.mustChangePass,
  });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await req.prisma.refreshToken.updateMany({
    where: { tokenHash, userId: req.user!.userId },
    data: { revokedAt: new Date() },
  });

  res.status(204).end();
};

export const register = async (req: Request, res: Response) => {
  const { orgName, orgSlug, name, email, password } = registerSchema.parse(req.body);

  const slugTaken = await req.prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (slugTaken) throw conflict('Organization slug already taken', 'ORG_SLUG_TAKEN');

  const passwordHash = await bcrypt.hash(password, 10);

  // Create org + admin user + backfill ownerId atomically. We use the interactive
  // form because the org.update needs the just-created user.id.
  const user = await req.prisma.$transaction(async (tx) => {
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

  const tokens = await issueTokens(user, req.prisma);

  res.status(201).json({
    ...tokens,
    mustChangePass: false,
  });
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

  const tokens = await issueTokens(user, req.prisma);

  res.json({
    ...tokens,
    mustChangePass: false,
  });
};
