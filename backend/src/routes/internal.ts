import { Router, type Router as IRouter } from 'express'
import * as internalController from '../controllers/internal.js'

const internalRouter: IRouter = Router()

internalRouter.post('/reconcile', internalController.postReconcile)

export default internalRouter
