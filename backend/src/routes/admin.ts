import { Router, type IRouter } from 'express';
import { requireJwt } from '../middleware/jwt.js';
import { requireRole } from '../middleware/requireRole.js';
import * as adminController from '../controllers/admin.js';

const router: IRouter = Router();

router.use(requireJwt);
router.use(requireRole('ADMIN'));

router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.delete('/users/:userId', adminController.deleteUser);
router.delete('/org', adminController.deleteOrg);

export default router;
