import { getDatabase } from '../database';

interface LoginLogInput {
  email: string;
  userId?: number;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
}

interface LoginLogFilters {
  email?: string;
  success?: boolean;
  limit?: number;
}

export class LoginLogService {
  log(input: LoginLogInput): void {
    try {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO login_logs (email, user_id, success, ip_address, user_agent, failure_reason)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        input.email,
        input.userId || null,
        input.success ? 1 : 0,
        input.ipAddress || null,
        input.userAgent || null,
        input.failureReason || null
      );
    } catch {
      // Never break the application due to logging
    }
  }

  getRecentFailures(email: string, windowMinutes: number = 15): number {
    const db = getDatabase();
    const result = db
      .prepare(
        `SELECT COUNT(*) as count FROM login_logs
         WHERE email = ? AND success = 0
         AND created_at > datetime('now', ?)
        `
      )
      .get(email, `-${windowMinutes} minutes`) as { count: number };
    return result.count;
  }

  getAll(filters: LoginLogFilters = {}): any[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM login_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.email) {
      sql += ' AND email = ?';
      params.push(filters.email);
    }

    if (filters.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filters.success ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(sql).all(...params);
  }
}

export const loginLogService = new LoginLogService();
