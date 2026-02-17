import { getDatabase } from '../../database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config';
import { UnauthorizedError, AppError } from '../../utils/errors';
import { sessionService } from '../../services/session.service';
import { loginLogService } from '../../services/loginLog.service';
import { auditLogService } from '../../services/auditLog.service';

interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

interface LoginResult {
  token: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

interface RefreshResult {
  token: string;
  expiresIn: string;
}

export class AuthService {
  async login(input: LoginInput): Promise<LoginResult> {
    const db = getDatabase();

    const user = db
      .prepare('SELECT id, name, email, password, role, active, failed_login_attempts, locked_until FROM users WHERE email = ?')
      .get(input.email) as any;

    if (!user) {
      loginLogService.log({
        email: input.email,
        success: false,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        failureReason: 'user_not_found',
      });
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    // Check account lockout
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        loginLogService.log({
          email: input.email,
          userId: user.id,
          success: false,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          failureReason: 'account_locked',
        });
        throw new AppError(
          `Conta bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} minuto(s).`,
          423
        );
      } else {
        // Lock expired, reset
        db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }
    }

    if (!user.active) {
      loginLogService.log({
        email: input.email,
        userId: user.id,
        success: false,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        failureReason: 'user_inactive',
      });
      throw new UnauthorizedError('Usuário desativado');
    }

    const validPassword = await bcrypt.compare(input.password, user.password);
    if (!validPassword) {
      // Increment failed attempts
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      
      if (newAttempts >= config.security.maxFailedAttempts) {
        const lockUntil = new Date(Date.now() + config.security.lockoutMinutes * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
          .run(newAttempts, lockUntil, user.id);

        loginLogService.log({
          email: input.email,
          userId: user.id,
          success: false,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          failureReason: 'account_locked_max_attempts',
        });

        auditLogService.log({
          userId: user.id,
          action: 'USER_LOCK',
          resource: 'user',
          resourceId: user.id,
          details: `Conta bloqueada após ${newAttempts} tentativas falhas`,
          ipAddress: input.ipAddress,
        });

        throw new AppError(
          `Conta bloqueada após ${config.security.maxFailedAttempts} tentativas falhas. Tente novamente em ${config.security.lockoutMinutes} minutos.`,
          423
        );
      } else {
        db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?')
          .run(newAttempts, user.id);
      }

      loginLogService.log({
        email: input.email,
        userId: user.id,
        success: false,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        failureReason: 'invalid_password',
      });

      const remaining = config.security.maxFailedAttempts - newAttempts;
      throw new UnauthorizedError(
        `Email ou senha inválidos. ${remaining} tentativa(s) restante(s).`
      );
    }

    // Successful login — reset failed attempts
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    // Generate token with JTI
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { id: user.id, role: user.role, jti },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    // Calculate expiration dates
    const tokenExpiresAt = new Date(Date.now() + parseExpiry(config.jwt.expiresIn)).toISOString();
    const refreshExpiresAt = new Date(Date.now() + parseExpiry(config.jwt.refreshExpiresIn)).toISOString();

    // Create session
    const { refreshToken } = sessionService.createSession({
      userId: user.id,
      tokenJti: jti,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt: tokenExpiresAt,
      refreshExpiresAt,
    });

    // Log success
    loginLogService.log({
      email: input.email,
      userId: user.id,
      success: true,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    auditLogService.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'session',
      details: `Login bem-sucedido`,
      ipAddress: input.ipAddress,
    });

    return {
      token,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  refreshToken(refreshToken: string): RefreshResult {
    const session = sessionService.findByRefreshToken(refreshToken);

    if (!session) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    // Check refresh token expiration
    if (new Date(session.refresh_expires_at) < new Date()) {
      sessionService.revokeSession(session.id);
      throw new UnauthorizedError('Refresh token expirado. Faça login novamente.');
    }

    // Check if user is still active
    const db = getDatabase();
    const user = db
      .prepare('SELECT id, role, active FROM users WHERE id = ?')
      .get(session.user_id) as any;

    if (!user || !user.active) {
      sessionService.revokeSession(session.id);
      throw new UnauthorizedError('Usuário desativado');
    }

    // Generate new access token
    const newJti = crypto.randomUUID();
    const token = jwt.sign(
      { id: user.id, role: user.role, jti: newJti },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    const newExpiresAt = new Date(Date.now() + parseExpiry(config.jwt.expiresIn)).toISOString();
    sessionService.updateSessionToken(session.id, newJti, newExpiresAt);

    return {
      token,
      expiresIn: config.jwt.expiresIn,
    };
  }

  logout(tokenJti: string, userId: number, ipAddress?: string): void {
    sessionService.revokeByJti(tokenJti);

    auditLogService.log({
      userId,
      action: 'LOGOUT',
      resource: 'session',
      details: 'Logout realizado',
      ipAddress,
    });
  }

  logoutAll(userId: number, ipAddress?: string): void {
    sessionService.revokeAllUserSessions(userId);

    auditLogService.log({
      userId,
      action: 'LOGOUT_ALL',
      resource: 'session',
      details: 'Todas as sessões encerradas',
      ipAddress,
    });
  }

  getActiveSessions(userId: number) {
    return sessionService.getActiveSessions(userId).map((s) => ({
      id: s.id,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      created_at: s.created_at,
      expires_at: s.expires_at,
    }));
  }

  revokeSession(sessionId: number, userId: number, currentUserRole: string): void {
    const db = getDatabase();
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as any;

    if (!session) {
      throw new UnauthorizedError('Sessão não encontrada');
    }

    // Only allow revoking own sessions or admin revoking any
    if (session.user_id !== userId && currentUserRole !== 'admin') {
      throw new UnauthorizedError('Sem permissão para encerrar esta sessão');
    }

    sessionService.revokeSession(sessionId);
  }
}

/**
 * Parse string like '30m', '8h', '7d' into milliseconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 60 * 1000; // default 30min

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 30 * 60 * 1000;
  }
}

export const authService = new AuthService();
