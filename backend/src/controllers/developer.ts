import { type Request, type Response } from 'express';
import crypto from 'crypto';
import { notFound } from '../utils/errors.js';
import { updateMeSchema } from '../validators/developer.js';
import { parsePageParams } from '../utils/pagination.js';

export const updateMe = async (req: Request, res: Response) => {
  const { name } = updateMeSchema.parse(req.body);

  const updated = await req.prisma.user.update({
    where: { id: req.user!.userId },
    data: { name },
    select: { id: true, name: true, email: true, role: true, mustChangePass: true },
  });

  res.json(updated);
};

export const getSessions = async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePageParams(req.query);

  const [sessions, total] = await Promise.all([
    req.prisma.session.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        project: { select: { name: true, slug: true } },
      }
    }),
    req.prisma.session.count({ where: { userId: req.user!.userId } }),
  ]);

  res.json({
    sessions: sessions.map(s => ({
      ...s,
      durationMs: s.durationMs.toString(),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  });
};

export const getSessionById = async (req: Request, res: Response) => {
  const session = await req.prisma.session.findUnique({
    where: { id: req.params['sessionId'] as string },
    include: {
      project: { select: { name: true, slug: true } },
    }
  });

  if (!session || session.userId !== req.user!.userId) {
    throw notFound('Session not found');
  }

  res.json({
    ...session,
    durationMs: session.durationMs.toString(),
  });
};

export const getApiKeys = async (req: Request, res: Response) => {
  const keys = await req.prisma.apiKey.findMany({
    where: { userId: req.user!.userId },
    select: {
      id: true,
      label: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    }
  });

  res.json({ keys });
};

export const createApiKey = async (req: Request, res: Response) => {
  const rawKey = `dsk_${crypto.randomBytes(32).toString('base64url')}`;
  const signingSecret = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await req.prisma.apiKey.create({
    data: {
      userId: req.user!.userId,
      orgId: req.user!.orgId,
      keyHash,
      signingSecret,
      label: req.body.label || 'Default',
    }
  });

  res.status(201).json({
    id: apiKey.id,
    key: rawKey,
    signing_secret: signingSecret,
    label: apiKey.label,
  });
};

export const deleteApiKey = async (req: Request, res: Response) => {
  await req.prisma.apiKey.updateMany({
    where: { id: req.params['keyId'] as string, userId: req.user!.userId },
    data: { revokedAt: new Date() },
  });

  res.status(204).end();
};
