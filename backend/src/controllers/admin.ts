import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { inviteManagerSchema } from '../validators/admin.js';

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

export const createUser = async (req: Request, res: Response) => {
  const { name, email, role } = inviteManagerSchema.parse(req.body);

  // 12-char URL-safe; ~9 bytes of entropy keeps it short but uncrackable
  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    const user = await req.prisma.user.create({
      data: {
        orgId: req.user!.orgId,
        email,
        name,
        role,
        passwordHash,
        mustChangePass: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(201).json({ ...user, tempPassword });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('A user with this email already exists in your organization', 'EMAIL_TAKEN');
    }
    throw err;
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const targetId = req.params['userId'] as string;

  if (targetId === req.user!.userId) {
    throw forbidden('You cannot remove yourself');
  }

  const target = await req.prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, orgId: true, role: true },
  });

  if (!target || target.orgId !== req.user!.orgId) {
    throw notFound('User');
  }

  if (target.role === 'ADMIN') {
    throw forbidden('Cannot remove another admin');
  }

  await req.prisma.user.delete({ where: { id: targetId } });

  res.status(204).end();
};
