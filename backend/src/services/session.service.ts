import { getDatabase } from '../database';
import crypto from 'crypto';

interface CreateSessionInput {
  userId: number;
  tokenJti: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  refreshExpiresAt: string;
}

interface Session {
  id: number;
  user_id: number;
  token_jti: string;
  refresh_token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  refresh_expires_at: string;
  revoked: number;
  created_at: string;
}

export class SessionService {
  createSession(input: CreateSessionInput): { refreshToken: string } {
    const db = getDatabase();
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Enforce max sessions per user
    this.enforceMaxSessions(input.userId);

    db.prepare(
      `INSERT INTO sessions (user_id, token_jti, refresh_token, ip_address, user_agent, expires_at, refresh_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.userId,
      input.tokenJti,
      refreshToken,
      input.ipAddress || null,
      input.userAgent || null,
      input.expiresAt,
      input.refreshExpiresAt
    );

    return { refreshToken };
  }

  findByJti(jti: string): Session | undefined {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM sessions WHERE token_jti = ? AND revoked = 0')
      .get(jti) as Session | undefined;
  }

  findByRefreshToken(refreshToken: string): Session | undefined {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM sessions WHERE refresh_token = ? AND revoked = 0')
      .get(refreshToken) as Session | undefined;
  }

  isTokenRevoked(jti: string): boolean {
    const session = this.findByJti(jti);
    return !session; // If no active session found, consider it revoked
  }

  revokeSession(sessionId: number): void {
    const db = getDatabase();
    db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(sessionId);
  }

  revokeByJti(jti: string): void {
    const db = getDatabase();
    db.prepare('UPDATE sessions SET revoked = 1 WHERE token_jti = ?').run(jti);
  }

  revokeAllUserSessions(userId: number): void {
    const db = getDatabase();
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(userId);
  }

  getActiveSessions(userId: number): Session[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT * FROM sessions
         WHERE user_id = ? AND revoked = 0 AND refresh_expires_at > datetime('now','localtime')
         ORDER BY created_at DESC`
      )
      .all(userId) as Session[];
  }

  updateSessionToken(sessionId: number, newJti: string, newExpiresAt: string): void {
    const db = getDatabase();
    db.prepare('UPDATE sessions SET token_jti = ?, expires_at = ? WHERE id = ?')
      .run(newJti, newExpiresAt, sessionId);
  }

  cleanExpiredSessions(): number {
    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM sessions WHERE revoked = 1 OR refresh_expires_at < datetime('now','localtime')")
      .run();
    return result.changes;
  }

  enforceMaxSessions(userId: number, maxSessions: number = 5): void {
    const db = getDatabase();
    const activeSessions = db
      .prepare(
        `SELECT id FROM sessions
         WHERE user_id = ? AND revoked = 0 AND refresh_expires_at > datetime('now','localtime')
         ORDER BY created_at ASC`
      )
      .all(userId) as { id: number }[];

    // If at limit, revoke the oldest sessions
    if (activeSessions.length >= maxSessions) {
      const toRevoke = activeSessions.slice(0, activeSessions.length - maxSessions + 1);
      for (const session of toRevoke) {
        this.revokeSession(session.id);
      }
    }
  }
}

export const sessionService = new SessionService();
