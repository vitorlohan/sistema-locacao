import { Router } from 'express';
import { userController } from './user.controller';
import { authMiddleware, adminOnly, requirePermission, validate } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate([
    { field: 'name', required: true, type: 'string', minLength: 2 },
    { field: 'email', required: true, type: 'email' },
    { field: 'password', required: true, type: 'string', minLength: 6 },
  ]),
  (req, res, next) => {
    userController.create(req, res).catch(next);
  }
);

router.get('/', requirePermission(PERMISSIONS.USERS_READ), (req, res) => {
  userController.findAll(req, res);
});

router.get('/:id', requirePermission(PERMISSIONS.USERS_READ), (req, res) => {
  userController.findById(req, res);
});

router.put(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  (req, res, next) => {
    userController.update(req, res).catch(next);
  }
);

router.put(
  '/:id/permissions',
  adminOnly,
  (req, res) => {
    userController.updatePermissions(req, res);
  }
);

router.post(
  '/:id/unlock',
  adminOnly,
  (req, res) => {
    userController.unlockAccount(req, res);
  }
);

router.delete('/:id', requirePermission(PERMISSIONS.USERS_DELETE), (req, res) => {
  userController.delete(req, res);
});

export default router;
