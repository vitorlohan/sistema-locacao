import { Router } from 'express';
import { authController } from './auth.controller';
import { validate, authMiddleware, adminOnly, loginRateLimit } from '../../middlewares';
import config from '../../config';

const router = Router();

// Public routes (with rate limiting)
router.post(
  '/login',
  loginRateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.loginRateLimitMax,
  }),
  validate([
    { field: 'email', required: true, type: 'email' },
    { field: 'password', required: true, type: 'string', minLength: 3 },
  ]),
  (req, res, next) => {
    authController.login(req, res).catch(next);
  }
);

router.post(
  '/refresh',
  (req, res) => {
    authController.refreshToken(req, res);
  }
);

// Protected routes
router.post('/logout', authMiddleware, (req, res) => {
  authController.logout(req, res);
});

router.post('/logout-all', authMiddleware, (req, res) => {
  authController.logoutAll(req, res);
});

router.get('/me', authMiddleware, (req, res) => {
  authController.me(req, res);
});

router.get('/sessions', authMiddleware, (req, res) => {
  authController.getSessions(req, res);
});

router.delete('/sessions/:sessionId', authMiddleware, (req, res) => {
  authController.revokeSession(req, res);
});

// Admin-only log routes
router.get('/logs/login', authMiddleware, adminOnly, (req, res) => {
  authController.getLoginLogs(req, res);
});

router.get('/logs/audit', authMiddleware, adminOnly, (req, res) => {
  authController.getAuditLogs(req, res);
});

export default router;
