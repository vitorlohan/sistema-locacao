import { Router } from 'express';
import { itemController } from './item.controller';
import { authMiddleware, requirePermission, validate } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  requirePermission(PERMISSIONS.ITEMS_CREATE),
  validate([
    { field: 'name', required: true, type: 'string', minLength: 2 },
    { field: 'internal_code', required: true, type: 'string' },
    { field: 'category', required: true, type: 'string' },
  ]),
  (req, res) => {
    itemController.create(req, res);
  }
);

router.get('/categories', requirePermission(PERMISSIONS.ITEMS_READ), (req, res) => {
  itemController.getCategories(req, res);
});

router.get('/', requirePermission(PERMISSIONS.ITEMS_READ), (req, res) => {
  itemController.findAll(req, res);
});

router.get('/:id', requirePermission(PERMISSIONS.ITEMS_READ), (req, res) => {
  itemController.findById(req, res);
});

router.put('/:id', requirePermission(PERMISSIONS.ITEMS_UPDATE), (req, res) => {
  itemController.update(req, res);
});

router.delete('/:id', requirePermission(PERMISSIONS.ITEMS_DELETE), (req, res) => {
  itemController.delete(req, res);
});

/* Pricing tiers */
router.get('/:id/pricing', requirePermission(PERMISSIONS.ITEMS_READ), (req, res) => {
  itemController.getPricing(req, res);
});

router.put('/:id/pricing', requirePermission(PERMISSIONS.ITEMS_UPDATE), (req, res) => {
  itemController.savePricing(req, res);
});

export default router;
