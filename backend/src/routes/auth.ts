import { Router } from 'express';
import { loginRateLimit } from '../middleware/rateLimit.js';
import { requireJwt } from '../middleware/jwt.js';
import * as authController from '../controllers/auth.js';

const router: ReturnType<typeof Router> = Router();

router.post('/login', loginRateLimit, authController.login);
router.post('/register', loginRateLimit, authController.register);
router.post('/refresh', authController.refresh);
router.post('/logout', requireJwt, authController.logout);
router.post('/change-password', requireJwt, authController.changePassword);

export default router;
