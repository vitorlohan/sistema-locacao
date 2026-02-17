import { Router } from 'express';
import { rentalController } from './rental.controller';
import { authMiddleware, requirePermission, validate } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  requirePermission(PERMISSIONS.RENTALS_CREATE),
  validate([
    { field: 'client_id', required: true, type: 'number' },
    { field: 'item_id', required: true, type: 'number' },
    { field: 'start_date', required: true, type: 'string' },
    { field: 'expected_end_date', required: true, type: 'string' },
  ]),
  (req, res) => {
    rentalController.create(req, res);
  }
);

router.get('/', requirePermission(PERMISSIONS.RENTALS_READ), (req, res) => {
  rentalController.findAll(req, res);
});

router.post('/check-overdue', (req, res) => {
  rentalController.checkOverdue(req, res);
});

router.get('/:id', requirePermission(PERMISSIONS.RENTALS_READ), (req, res) => {
  rentalController.findById(req, res);
});

router.post('/:id/complete', requirePermission(PERMISSIONS.RENTALS_UPDATE), (req, res) => {
  rentalController.complete(req, res);
});

router.post('/:id/cancel', requirePermission(PERMISSIONS.RENTALS_CANCEL), (req, res) => {
  rentalController.cancel(req, res);
});

router.post('/:id/send-to-cashier', requirePermission(PERMISSIONS.RENTALS_UPDATE), (req, res) => {
  rentalController.sendToCashier(req, res);
});

export default router;
