import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { hasPermission, Permission } from '../utils/permissions';
import { sessionService } from '../services/session.service';
import { getDatabase } from '../database';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userPermissions?: string[];
  tokenJti?: string;
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Token não fornecido');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedError('Token malformado');
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: number;
      role: string;
      jti: string;
    };

    // Verify session is still active (token not revoked)
    if (decoded.jti && sessionService.isTokenRevoked(decoded.jti)) {
      throw new UnauthorizedError('Sessão encerrada');
    }

    // Load user permissions from DB
    const db = getDatabase();
    const user = db
      .prepare('SELECT permissions, active FROM users WHERE id = ?')
      .get(decoded.id) as { permissions: string; active: number } | undefined;

    if (!user || !user.active) {
      throw new UnauthorizedError('Usuário desativado');
    }

    let userPermissions: string[] = [];
    try {
      userPermissions = JSON.parse(user.permissions || '[]');
    } catch {
      userPermissions = [];
    }

    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.userPermissions = userPermissions;
    req.tokenJti = decoded.jti;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Token inválido ou expirado');
  }
}

export function adminOnly(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    throw new ForbiddenError('Acesso restrito a administradores');
  }
  next();
}

/**
 * Middleware factory para verificar permissão específica.
 * Admin passa automaticamente.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.userId || !req.userRole) {
      throw new UnauthorizedError('Não autenticado');
    }

    if (!hasPermission(req.userRole, req.userPermissions || [], permission)) {
      throw new ForbiddenError(`Permissão necessária: ${permission}`);
    }

    next();
  };
}
