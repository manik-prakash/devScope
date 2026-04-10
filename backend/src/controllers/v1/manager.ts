import { type Request, type Response } from 'express';
import { z } from 'zod';
import { notFound } from '../../utils/errors.js';

export const getOrg = async (req: Request, res: Response) => {
  const org = await req.prisma.organization.findUnique({
    where: { id: req.user!.orgId },
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  if (!org) throw notFound('Organization not found');

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    seats: org.seats,
    current_users: org._count.users,
  });
};

export const getUsers = async (req: Request, res: Response) => {
  const users = await req.prisma.user.findMany({
    where: { orgId: req.user!.orgId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    }
  });

  res.json({ users });
};

export const createProject = async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  });

  const { name, slug } = schema.parse(req.body);

  const project = await req.prisma.project.create({
    data: {
      name,
      slug,
      orgId: req.user!.orgId,
    }
  });

  res.status(201).json(project);
};

export const getSessions = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    req.prisma.session.findMany({
      where: { orgId: req.user!.orgId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        project: { select: { name: true, slug: true } },
      }
    }),
    req.prisma.session.count({ where: { orgId: req.user!.orgId } }),
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
      user: { select: { name: true, email: true } },
      project: { select: { name: true, slug: true } },
    }
  });

  if (!session || session.orgId !== req.user!.orgId) {
    throw notFound('Session not found');
  }

  res.json({
    ...session,
    durationMs: session.durationMs.toString(),
  });
};
