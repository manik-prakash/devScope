/**
 * src/middleware/prismaMiddleware.ts
 *
 * Attaches the singleton PrismaClient to every request as `req.prisma`.
 * This keeps handlers free of module-level imports and makes the client
 * trivial to swap with a mock in integration tests.
 */

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
