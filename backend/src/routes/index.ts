import { Router } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import propertyRoutes from './property.routes';

/**
 * Root API router. The inquiry router is mounted in Session 7.
 */
const router = Router();

router.use(healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/properties', propertyRoutes);

export default router;
