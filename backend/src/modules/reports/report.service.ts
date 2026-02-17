import { getDatabase } from '../../database';

interface DashboardData {
  total_clients: number;
  total_items: number;
  items_available: number;
  items_rented: number;
  items_maintenance: number;
  active_rentals: number;
  overdue_rentals: number;
  revenue_today: number;
  revenue_month: number;
  revenue_total: number;
}

interface RevenueByPeriod {
  period: string;
  total: number;
  count: number;
}

interface TopItem {
  item_id: number;
  item_name: string;
  internal_code: string;
  rental_count: number;
  total_revenue: number;
}

interface TopClient {
  client_id: number;
  client_name: string;
  rental_count: number;
  total_spent: number;
}

interface ItemInfo {
  id: number;
  name: string;
  internal_code: string;
  category: string;
  rental_value: number;
  rental_period: string;
  status: string;
  observations: string | null;
}

interface RentalHistory {
  id: number;
  client_name: string;
  item_name: string;
  internal_code: string;
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  rental_value: number;
  total_value: number;
  status: string;
  created_at: string;
}

interface RentalHistoryFilters {
  clientId?: number;
  itemId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class ReportService {
  getDashboard(): DashboardData {
    const db = getDatabase();

    const totalClients = (db.prepare('SELECT COUNT(*) as count FROM clients WHERE active = 1').get() as any).count;
    const totalItems = (db.prepare('SELECT COUNT(*) as count FROM items WHERE active = 1').get() as any).count;
    const itemsAvailable = (db.prepare("SELECT COUNT(*) as count FROM items WHERE active = 1 AND status = 'available'").get() as any).count;
    const itemsRented = (db.prepare("SELECT COUNT(*) as count FROM items WHERE active = 1 AND status = 'rented'").get() as any).count;
    const itemsMaintenance = (db.prepare("SELECT COUNT(*) as count FROM items WHERE active = 1 AND status = 'maintenance'").get() as any).count;
    const activeRentals = (db.prepare("SELECT COUNT(*) as count FROM rentals WHERE status = 'active'").get() as any).count;
    const overdueRentals = (db.prepare("SELECT COUNT(*) as count FROM rentals WHERE status = 'overdue'").get() as any).count;

    const revenueToday = (db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE date(payment_date) = date('now')"
    ).get() as any).total;

    const revenueMonth = (db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')"
    ).get() as any).total;

    const revenueTotal = (db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments'
    ).get() as any).total;

    return {
      total_clients: totalClients,
      total_items: totalItems,
      items_available: itemsAvailable,
      items_rented: itemsRented,
      items_maintenance: itemsMaintenance,
      active_rentals: activeRentals,
      overdue_rentals: overdueRentals,
      revenue_today: revenueToday,
      revenue_month: revenueMonth,
      revenue_total: revenueTotal,
    };
  }

  getRevenueByDay(startDate: string, endDate: string): RevenueByPeriod[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT date(payment_date) as period, SUM(amount) as total, COUNT(*) as count 
         FROM payments 
         WHERE date(payment_date) BETWEEN ? AND ? 
         GROUP BY date(payment_date) 
         ORDER BY period`
      )
      .all(startDate, endDate) as RevenueByPeriod[];
  }

  getRevenueByMonth(year: number): RevenueByPeriod[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT strftime('%Y-%m', payment_date) as period, SUM(amount) as total, COUNT(*) as count 
         FROM payments 
         WHERE strftime('%Y', payment_date) = ? 
         GROUP BY strftime('%Y-%m', payment_date) 
         ORDER BY period`
      )
      .all(String(year)) as RevenueByPeriod[];
  }

  getTopItems(limit: number = 10): TopItem[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT r.item_id, i.name as item_name, i.internal_code, 
                COUNT(*) as rental_count, SUM(r.total_value) as total_revenue 
         FROM rentals r 
         JOIN items i ON r.item_id = i.id 
         GROUP BY r.item_id 
         ORDER BY rental_count DESC 
         LIMIT ?`
      )
      .all(limit) as TopItem[];
  }

  getTopClients(limit: number = 10): TopClient[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT r.client_id, c.name as client_name, 
                COUNT(*) as rental_count, SUM(r.total_value) as total_spent 
         FROM rentals r 
         JOIN clients c ON r.client_id = c.id 
         GROUP BY r.client_id 
         ORDER BY total_spent DESC 
         LIMIT ?`
      )
      .all(limit) as TopClient[];
  }

  getPaymentMethodStats(): { method: string; total: number; count: number }[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT payment_method as method, SUM(amount) as total, COUNT(*) as count 
         FROM payments 
         GROUP BY payment_method 
         ORDER BY total DESC`
      )
      .all() as { method: string; total: number; count: number }[];
  }

  // ─── Novos relatórios ────────────────────────────────────

  getAvailableItems(): ItemInfo[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT id, name, internal_code, category, rental_value, rental_period, status, observations
         FROM items
         WHERE active = 1 AND status = 'available'
         ORDER BY category, name`
      )
      .all() as ItemInfo[];
  }

  getMaintenanceItems(): ItemInfo[] {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT id, name, internal_code, category, rental_value, rental_period, status, observations
         FROM items
         WHERE active = 1 AND status = 'maintenance'
         ORDER BY category, name`
      )
      .all() as ItemInfo[];
  }

  getRentalHistory(filters: RentalHistoryFilters = {}): { data: RentalHistory[]; total: number } {
    const db = getDatabase();
    const whereClauses = ['1=1'];
    const params: any[] = [];

    if (filters.clientId) {
      whereClauses.push('r.client_id = ?');
      params.push(filters.clientId);
    }

    if (filters.itemId) {
      whereClauses.push('r.item_id = ?');
      params.push(filters.itemId);
    }

    if (filters.status) {
      whereClauses.push('r.status = ?');
      params.push(filters.status);
    }

    if (filters.startDate) {
      whereClauses.push('r.start_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('r.start_date <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }

    const where = whereClauses.join(' AND ');

    const total = (
      db
        .prepare(`SELECT COUNT(*) as count FROM rentals r WHERE ${where}`)
        .get(...params) as any
    ).count;

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const data = db
      .prepare(
        `SELECT r.id, c.name as client_name, i.name as item_name, i.internal_code,
                r.start_date, r.expected_end_date, r.actual_end_date,
                r.rental_value, r.total_value, r.status, r.created_at
         FROM rentals r
         JOIN clients c ON r.client_id = c.id
         JOIN items i ON r.item_id = i.id
         WHERE ${where}
         ORDER BY r.start_date DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as RentalHistory[];

    return { data, total };
  }

  /**
   * Receita por período customizável (agrupar por dia, semana ou mês).
   */
  getRevenueByPeriod(startDate: string, endDate: string, groupBy: 'day' | 'week' | 'month' = 'day'): RevenueByPeriod[] {
    const db = getDatabase();

    let groupExpr: string;
    switch (groupBy) {
      case 'week':
        groupExpr = "strftime('%Y-W%W', payment_date)";
        break;
      case 'month':
        groupExpr = "strftime('%Y-%m', payment_date)";
        break;
      default:
        groupExpr = "date(payment_date)";
    }

    return db
      .prepare(
        `SELECT ${groupExpr} as period, SUM(amount) as total, COUNT(*) as count
         FROM payments
         WHERE date(payment_date) BETWEEN ? AND ?
         GROUP BY ${groupExpr}
         ORDER BY period`
      )
      .all(startDate, endDate) as RevenueByPeriod[];
  }
}

export const reportService = new ReportService();
