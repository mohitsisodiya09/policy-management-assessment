import { Router } from 'express';
import policyRoutes from './policy.routes.js';
import scheduleRoutes from './schedule.routes.js';
import uploadRoutes from './upload.routes.js';

const router = Router();

router.use('/upload', uploadRoutes);
router.use('/policies', policyRoutes);
router.use('/schedule', scheduleRoutes);

export default router;
