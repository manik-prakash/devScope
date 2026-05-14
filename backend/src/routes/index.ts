import { Router, type IRouter } from 'express';
import { healthRouter } from './health.js';
import authRouter from './auth.js';
import cliRouter from './cli.js';
import managerRouter from './manager.js';
import developerRouter from './developer.js';
import adminRouter from './admin.js';

const router: IRouter = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/cli', cliRouter);
router.use('/manager', managerRouter);
router.use('/developer', developerRouter);
router.use('/admin', adminRouter);

export default router;
