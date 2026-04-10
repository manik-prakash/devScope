/**
 * src/routes/v1/health.ts
 *
 * GET /api/v1/health
 * Public endpoint — no authentication required.
 * Returns DB connectivity status, app version, and uptime.
 */

import { Router, type Router as IRouter } from 'express'
import * as healthController from '../../controllers/v1/health.js'

export const healthRouter: IRouter = Router()

healthRouter.get('/', healthController.getHealth)
