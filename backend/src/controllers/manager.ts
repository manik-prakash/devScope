import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { createProjectSchema, inviteEngineerSchema } from '../validators/manager.js';
import { parsePageParams, SESSION_LIST_MAX_LIMIT } from '../utils/pagination.js';
import { scoreDetailInclude } from '../utils/sessionSelect.js';
import { assertSeatAvailable } from '../utils/seats.js';

export const getOrg = async (req: Request, res: Response) => {
  const org = await req.prisma.organization.findUnique({
    where: { id: req.user!.orgId },
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  if (!org) throw notFound('Organization');

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
      mustChangePass: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ users });
};

export const getUserById = async (req: Request, res: Response) => {
  const user = await req.prisma.user.findFirst({
    where: { id: req.params['userId'] as string, orgId: req.user!.orgId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mustChangePass: true,
      createdAt: true,
    },
  });

  if (!user) throw notFound('User');

  res.json({ user });
};

export const getProjects = async (req: Request, res: Response) => {
  // Admins see every project in the org; managers only see ones they're a member of.
  const where: Prisma.ProjectWhereInput = req.user!.role === 'ADMIN'
    ? { orgId: req.user!.orgId }
    : { orgId: req.user!.orgId, members: { some: { userId: req.user!.userId } } };

  const projects = await req.prisma.project.findMany({
    where,
    include: {
      _count: { select: { members: true, sessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ projects });
};

export const getProjectBySlug = async (req: Request, res: Response) => {
  const slug = req.params['slug'] as string;

  const project = await req.prisma.project.findFirst({
    where: { orgId: req.user!.orgId, slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, mustChangePass: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { sessions: true } },
    },
  });

  if (!project) throw notFound('Project');

  // Admins can view any project in their org; managers/developers must be members.
  const isMember = project.members.some((m) => m.userId === req.user!.userId);
  if (!isMember && req.user!.role !== 'ADMIN') {
    throw forbidden('You are not a member of this project');
  }

  res.json(project);
};

export const createProject = async (req: Request, res: Response) => {
  const { name, slug } = createProjectSchema.parse(req.body);

  try {
    const project = await req.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: { name, slug, orgId: req.user!.orgId },
      });
      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId:    req.user!.userId,
          role:      'MANAGER',
        },
      });
      return created;
    });

    res.status(201).json(project);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A project with this slug already exists', 'PROJECT_SLUG_TAKEN');
    }
    throw err;
  }
};

export const addProjectMember = async (req: Request, res: Response) => {
  const projectId = req.params['projectId'] as string;
  const { name, email } = inviteEngineerSchema.parse(req.body);

  // The caller must be a member of this project (any role)
  const project = await req.prisma.project.findFirst({
    where: { id: projectId, orgId: req.user!.orgId },
    include: {
      members: { where: { userId: req.user!.userId }, select: { userId: true } },
    },
  });
  if (!project) throw notFound('Project');
  if (project.members.length === 0 && req.user!.role !== 'ADMIN') {
    throw forbidden('You are not a member of this project');
  }

  // Does a user with this email already exist in the org?
  const existing = await req.prisma.user.findUnique({
    where: { orgId_email: { orgId: req.user!.orgId, email } },
    select: { id: true, name: true, email: true, role: true },
  });

  if (existing) {
    const alreadyMember = await req.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: existing.id } },
    });
    if (alreadyMember) {
      throw conflict(`${existing.name} is already a member of this project`, 'ALREADY_MEMBER');
    }
    await req.prisma.projectMember.create({
      data: { projectId, userId: existing.id, role: existing.role },
    });
    res.status(201).json({
      id:           existing.id,
      name:         existing.name,
      email:        existing.email,
      role:         existing.role,
      tempPassword: null,
      isExisting:   true,
    });
    return;
  }

  // Fresh user — consumes a seat, so enforce the org limit first.
  await assertSeatAvailable(req.prisma, req.user!.orgId);

  // Create with temp password + ProjectMember in one transaction
  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    const created = await req.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          orgId: req.user!.orgId,
          email,
          name,
          role: 'DEVELOPER',
          passwordHash,
          mustChangePass: true,
        },
      });
      await tx.projectMember.create({
        data: { projectId, userId: user.id, role: 'DEVELOPER' },
      });
      return user;
    });

    res.status(201).json({
      id:           created.id,
      name:         created.name,
      email:        created.email,
      role:         created.role,
      tempPassword,
      isExisting:   false,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A user with this email already exists in your organization', 'EMAIL_TAKEN');
    }
    throw err;
  }
};

export const getSessions = async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePageParams(req.query, { maxLimit: SESSION_LIST_MAX_LIMIT });

  // Admins see every session in the org; managers only see sessions in projects
  // they're a member of (mirrors getProjects).
  const where: Prisma.SessionWhereInput = req.user!.role === 'ADMIN'
    ? { orgId: req.user!.orgId }
    : { orgId: req.user!.orgId, project: { members: { some: { userId: req.user!.userId } } } };

  const [sessions, total] = await Promise.all([
    req.prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        project: { select: { name: true, slug: true } },
        ...scoreDetailInclude,
      }
    }),
    req.prisma.session.count({ where }),
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
      ...scoreDetailInclude,
    }
  });

  if (!session || session.orgId !== req.user!.orgId) {
    throw notFound('Session');
  }

  // Managers may only open sessions in a project they belong to; admins may open any.
  if (req.user!.role !== 'ADMIN') {
    const member = await req.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: session.projectId, userId: req.user!.userId } },
    });
    if (!member) throw notFound('Session');
  }

  res.json({
    ...session,
    durationMs: session.durationMs.toString(),
  });
};
