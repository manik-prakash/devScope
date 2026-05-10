import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/prisma.js'

export function prismaMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  req.prisma = prisma
  next()
}
