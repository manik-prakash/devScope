import { Router } from 'express';
import { loginRateLimit } from '../../middleware/rateLimit.js';
import { requireJwt } from '../../middleware/jwt.js';
import * as authController from '../../controllers/v1/auth.js';

const router: ReturnType<typeof Router> = Router();

router.post('/login', loginRateLimit, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireJwt, authController.logout);

export default router;
