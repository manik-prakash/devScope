import { Router, type IRouter } from 'express';
import { requireJwt } from '../middleware/jwt.js';
import { requireRole } from '../middleware/requireRole.js';
import * as developerController from '../controllers/developer.js';

const router: IRouter = Router();

router.use(requireJwt);
// Admins inherit developer-scope capabilities (their own sessions, API keys, profile).
router.use(requireRole('ADMIN', 'MANAGER', 'DEVELOPER'));

router.patch('/me', developerController.updateMe);
router.get('/sessions', developerController.getSessions);
router.get('/sessions/:sessionId', developerController.getSessionById);
router.get('/api-keys', developerController.getApiKeys);
router.post('/api-keys', developerController.createApiKey);
router.delete('/api-keys/:keyId', developerController.deleteApiKey);

export default router;
