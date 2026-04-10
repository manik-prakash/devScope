import { Router, type IRouter } from 'express';
import { requireApiKey } from '../../middleware/apiKey.js';
import { sessionRateLimit } from '../../middleware/rateLimit.js';
import * as cliController from '../../controllers/v1/cli.js';

const router: IRouter = Router();

router.get('/me', requireApiKey, cliController.getMe);
router.post('/sessions', requireApiKey, sessionRateLimit, cliController.createSession);
router.get('/sessions/recent', requireApiKey, cliController.getRecentSessions);

export default router;
