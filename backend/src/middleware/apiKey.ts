import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { unauthorized } from '../utils/errors.js';

export const requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw unauthorized('Missing or invalid API key');
  }

  const key = authHeader.split(' ')[1];
  if (!key) throw unauthorized('Missing API key');

  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  try {
    const apiKey = await req.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw unauthorized('Invalid or revoked API key');
    }

    // Fire and forget lastUsedAt update
    req.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(err => console.error('Failed to update lastUsedAt:', err));

    req.user = {
      userId: apiKey.userId,
      orgId: apiKey.orgId,
      role: apiKey.user.role,
      type: 'apikey',
    };

    req.apiKey = {
      id: apiKey.id,
      userId: apiKey.userId,
      orgId: apiKey.orgId,
      signingSecret: apiKey.signingSecret,
    };

    next();
  } catch (error) {
    if (error !== null && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw unauthorized('Authentication failed');
  }
};
