import { Router } from 'express';
import { clientController } from './client.controller';
import { authMiddleware, requirePermission, validate } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  requirePermission(PERMISSIONS.CLIENTS_CREATE),
  validate([
    { field: 'name', required: true, type: 'string', minLength: 2 },
  ]),
  (req, res) => {
    clientController.create(req, res);
  }
);

router.get('/', requirePermission(PERMISSIONS.CLIENTS_READ), (req, res) => {
  clientController.findAll(req, res);
});

router.get('/:id', requirePermission(PERMISSIONS.CLIENTS_READ), (req, res) => {
  clientController.findById(req, res);
});

router.get('/:id/rentals', requirePermission(PERMISSIONS.CLIENTS_READ), (req, res) => {
  clientController.getRentalHistory(req, res);
});

router.put('/:id', requirePermission(PERMISSIONS.CLIENTS_UPDATE), (req, res) => {
  clientController.update(req, res);
});

router.delete('/:id', requirePermission(PERMISSIONS.CLIENTS_DELETE), (req, res) => {
  clientController.delete(req, res);
});

export default router;
