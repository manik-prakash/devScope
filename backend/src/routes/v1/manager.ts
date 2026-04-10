import { Router, type IRouter } from 'express';
import { requireJwt } from '../../middleware/jwt.js';
import { requireRole } from '../../middleware/requireRole.js';
import * as managerController from '../../controllers/v1/manager.js';

const router: IRouter = Router();

router.use(requireJwt);
router.use(requireRole('MANAGER'));

router.get('/org', managerController.getOrg);
router.get('/users', managerController.getUsers);
router.post('/projects', managerController.createProject);
router.get('/sessions', managerController.getSessions);
router.get('/sessions/:sessionId', managerController.getSessionById);

export default router;
