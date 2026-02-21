import { Router } from 'express';
import { settingsController } from './settings.controller';
import { authMiddleware } from '../../middlewares';

const router = Router();

router.use(authMiddleware);

// Anyone authenticated can read settings
router.get('/', (req, res) => settingsController.getAll(req, res));
router.get('/:key', (req, res) => settingsController.get(req, res));

// Set settings (admin-only enforced by controller checking role)
router.post('/', (req, res) => settingsController.set(req, res));
router.put('/batch', (req, res) => settingsController.setMany(req, res));

export default router;
