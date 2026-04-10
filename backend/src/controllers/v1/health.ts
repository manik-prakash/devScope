/**
 * src/controllers/v1/health.ts
 */

import { type Request, type Response } from 'express'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { version } = require('../../../package.json') as { version: string }

export const getHealth = async (req: Request, res: Response) => {
  let dbStatus: 'connected' | 'error' = 'connected'

  try {
    await req.prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    db: dbStatus,
    version,
    uptime: Math.floor(process.uptime()),
  })
}
