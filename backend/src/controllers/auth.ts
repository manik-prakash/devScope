import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import { loginSchema, refreshSchema } from '../validators/auth.js';

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await req.prisma.user.findFirst({
    where: { email },
    include: { org: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }

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

  await req.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  res.json({
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: env.JWT_EXPIRES_IN,
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
