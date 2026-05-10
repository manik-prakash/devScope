import { Router, type Router as IRouter } from 'express'
import * as healthController from '../controllers/health.js'

export const healthRouter: IRouter = Router()

healthRouter.get('/', healthController.getHealth)
