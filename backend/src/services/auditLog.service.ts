import { getDatabase } from '../database';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'USER_LOCK'
  | 'USER_UNLOCK'
  | 'PERMISSION_CHANGE'
  | 'RENTAL_CREATE'
  | 'RENTAL_COMPLETE'
  | 'RENTAL_CANCEL'
  | 'PAYMENT_CREATE'
  | 'PAYMENT_DELETE'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE';

interface AuditLogInput {
  userId?: number;
  action: string;
  resource: string;
  resourceId?: number;
  details?: string;
  ipAddress?: string;
}

interface AuditLogFilters {
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export class AuditLogService {
  log(input: AuditLogInput): void {
    try {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        input.userId,
        input.action,
        input.resource,
        input.resourceId || null,
        input.details || null,
        input.ipAddress || null
      );
    } catch {
      // Silently catch errors to never break the application
    }
  }

  getAll(filters: AuditLogFilters = {}): any[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.resource) {
      sql += ' AND resource = ?';
      params.push(filters.resource);
    }

    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(sql).all(...params);
  }
}

export const auditLogService = new AuditLogService();
