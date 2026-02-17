import { Router } from 'express';
import { paymentController } from './payment.controller';
import { authMiddleware, requirePermission, validate } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS_CREATE),
  validate([
    { field: 'rental_id', required: true, type: 'number' },
    { field: 'amount', required: true, type: 'number', min: 0.01 },
    { field: 'payment_method', required: true, type: 'string' },
  ]),
  (req, res) => {
    paymentController.create(req, res);
  }
);

router.get('/', requirePermission(PERMISSIONS.PAYMENTS_READ), (req, res) => {
  paymentController.findAll(req, res);
});

router.get('/balance/:rentalId', requirePermission(PERMISSIONS.PAYMENTS_READ), (req, res) => {
  paymentController.getBalance(req, res);
});

router.get('/:id', requirePermission(PERMISSIONS.PAYMENTS_READ), (req, res) => {
  paymentController.findById(req, res);
});

router.delete('/:id', requirePermission(PERMISSIONS.PAYMENTS_DELETE), (req, res) => {
  paymentController.delete(req, res);
});

export default router;
