import { Request, Response } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../middlewares';
import { loginLogService } from '../../services/loginLog.service';
import { auditLogService } from '../../services/auditLog.service';
import { getDatabase } from '../../database';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login({ email, password, ipAddress, userAgent });
    res.json(result);
  }

  refreshToken(req: Request, res: Response): void {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      res.status(400).json({ error: true, message: 'refresh_token é obrigatório' });
      return;
    }
    const result = authService.refreshToken(refresh_token);
    res.json(result);
  }

  logout(req: AuthRequest, res: Response): void {
    const ipAddress = req.ip || req.socket.remoteAddress;
    if (req.tokenJti && req.userId) {
      authService.logout(req.tokenJti, req.userId, ipAddress);
    }
    res.json({ message: 'Logout realizado com sucesso' });
  }

  logoutAll(req: AuthRequest, res: Response): void {
    const ipAddress = req.ip || req.socket.remoteAddress;
    if (req.userId) {
      authService.logoutAll(req.userId, ipAddress);
    }
    res.json({ message: 'Todas as sessões encerradas' });
  }

  getSessions(req: AuthRequest, res: Response): void {
    const sessions = authService.getActiveSessions(req.userId!);
    res.json(sessions);
  }

  revokeSession(req: AuthRequest, res: Response): void {
    const sessionId = Number(req.params.sessionId);
    authService.revokeSession(sessionId, req.userId!, req.userRole!);
    res.json({ message: 'Sessão encerrada' });
  }

  getLoginLogs(req: AuthRequest, res: Response): void {
    const filters = {
      email: req.query.email as string | undefined,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    };
    const logs = loginLogService.getAll(filters);
    res.json(logs);
  }

  getAuditLogs(req: AuthRequest, res: Response): void {
    const filters = {
      userId: req.query.user_id ? Number(req.query.user_id) : undefined,
      action: req.query.action as string | undefined,
      resource: req.query.resource as string | undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    };
    const logs = auditLogService.getAll(filters);
    res.json(logs);
  }

  me(req: AuthRequest, res: Response): void {
    const db = getDatabase();
    const user = db
      .prepare('SELECT id, name, email, role, permissions, active, created_at FROM users WHERE id = ?')
      .get(req.userId) as any;

    if (!user) {
      res.status(404).json({ error: true, message: 'Usuário não encontrado' });
      return;
    }

    res.json({
      ...user,
      permissions: JSON.parse(user.permissions || '[]'),
      active: !!user.active,
    });
  }
}

export const authController = new AuthController();
