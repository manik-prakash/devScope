import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: 'MANAGER' | 'DEVELOPER';
}

export const requireJwt = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];
  if (!token) throw unauthorized('Missing token');

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;

    req.user = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      type: 'jwt',
    };

    next();
  } catch (error) {
    throw unauthorized('Invalid or expired token');
  }
};
