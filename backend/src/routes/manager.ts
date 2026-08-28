import { Router, type IRouter } from 'express';
import { requireJwt } from '../middleware/jwt.js';
import { requireRole } from '../middleware/requireRole.js';
import * as managerController from '../controllers/manager.js';

const router: IRouter = Router();

router.use(requireJwt);
// Admins implicitly have all manager powers (they own the org).
router.use(requireRole('ADMIN', 'MANAGER'));

router.get('/org', managerController.getOrg);
router.get('/users', managerController.getUsers);
router.get('/users/:userId', managerController.getUserById);
router.get('/projects', managerController.getProjects);
router.get('/projects/:slug', managerController.getProjectBySlug);
router.post('/projects', managerController.createProject);
router.post('/projects/:projectId/members', managerController.addProjectMember);
router.get('/sessions', managerController.getSessions);
router.get('/sessions/:sessionId', managerController.getSessionById);

export default router;
