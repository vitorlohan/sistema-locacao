import { getDatabase } from '../../database';
import { NotFoundError, ConflictError, ValidationError, AppError } from '../../utils/errors';
import { encrypt, decrypt, diffInHours, diffInDays, localNow } from '../../utils';
import { itemService } from '../items/item.service';
import config from '../../config';
import { paymentService } from '../payments/payment.service';

interface CreateRentalInput {
  client_id: number;
  item_id: number;
  start_date: string;
  expected_end_date: string;
  deposit?: number;
  discount?: number;
  observations?: string;
  pricing_id?: number;
}

interface CompleteRentalInput {
  actual_end_date?: string;
}

interface RentalRow {
  id: number;
  client_id: number;
  item_id: number;
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  rental_value: number;
  deposit: number;
  late_fee: number;
  discount: number;
  total_value: number;
  status: string;
  observations: string | null;
  pricing_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

interface RentalResponse extends RentalRow {
  client_name?: string;
  item_name?: string;
  item_code?: string;
  total_paid?: number;
}

export class RentalService {
  create(input: CreateRentalInput): RentalResponse {
    const db = getDatabase();

    // Verify client exists
    const client = db.prepare('SELECT id, active FROM clients WHERE id = ?').get(input.client_id) as any;
    if (!client) throw new NotFoundError('Cliente');
    if (!client.active) throw new ValidationError('Cliente está desativado');

    // Verify item exists and is available
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(input.item_id) as any;
    if (!item) throw new NotFoundError('Item');
    if (!item.active) throw new ValidationError('Item está desativado');
    if (item.status !== 'available') {
      throw new ConflictError(`Item não está disponível (status atual: ${item.status})`);
    }

    // Calculate rental value — use pricing tier if provided, otherwise calculate from period
    let rentalValue: number;
    let pricingDurationMinutes: number | null = null;
    if (input.pricing_id) {
      const pricing = db.prepare('SELECT * FROM item_pricing WHERE id = ? AND item_id = ? AND active = 1').get(input.pricing_id, input.item_id) as any;
      if (!pricing) throw new ValidationError('Tabela de preço inválida para este item');
      rentalValue = pricing.price;
      pricingDurationMinutes = pricing.duration_minutes;
    } else {
      rentalValue = this.calculateRentalValue(
        item.rental_value,
        item.rental_period,
        new Date(input.start_date),
        new Date(input.expected_end_date)
      );
      // estimate duration in minutes for late fee calculation
      pricingDurationMinutes = Math.round(diffInHours(new Date(input.start_date), new Date(input.expected_end_date)) * 60);
    }

    const discount = input.discount || 0;
    const deposit = input.deposit || 0;
    const totalValue = rentalValue - discount;

    const transaction = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO rentals (client_id, item_id, start_date, expected_end_date, rental_value, deposit, discount, total_value, pricing_duration_minutes, status, observations) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
        )
        .run(
          input.client_id,
          input.item_id,
          input.start_date,
          input.expected_end_date,
          rentalValue,
          deposit,
          discount,
          totalValue,
          pricingDurationMinutes,
          input.observations ? encrypt(input.observations) : null
        );

      // Update item status to rented
      db.prepare("UPDATE items SET status = 'rented', updated_at = datetime('now','localtime') WHERE id = ?").run(input.item_id);

      const rentalId = result.lastInsertRowid as number;

      // Caução = pagamento antecipado: auto-register as payment
      if (deposit > 0) {
        db.prepare(
          `INSERT INTO payments (rental_id, amount, payment_method, payment_date, notes)
           VALUES (?, ?, 'cash', datetime('now','localtime'), ?)`
        ).run(rentalId, deposit, encrypt('Caução (pagamento antecipado)'));
      }

      return rentalId;
    });

    const rentalId = transaction();
    return this.findById(rentalId);
  }

  findAll(filters?: { status?: string; client_id?: number; item_id?: number }): RentalResponse[] {
    const db = getDatabase();
    let sql = `
      SELECT r.*, c.name as client_name, i.name as item_name, i.internal_code as item_code,
        COALESCE((SELECT SUM(amount) FROM payments WHERE rental_id = r.id), 0) as total_paid
      FROM rentals r 
      JOIN clients c ON r.client_id = c.id 
      JOIN items i ON r.item_id = i.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }
    if (filters?.client_id) {
      sql += ' AND r.client_id = ?';
      params.push(filters.client_id);
    }
    if (filters?.item_id) {
      sql += ' AND r.item_id = ?';
      params.push(filters.item_id);
    }

    sql += ' ORDER BY r.created_at DESC';

    const rows = db.prepare(sql).all(...params) as RentalResponse[];
    return rows.map((row) => ({
      ...row,
      observations: row.observations ? decrypt(row.observations) : null,
    }));
  }

  findById(id: number): RentalResponse {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT r.*, c.name as client_name, i.name as item_name, i.internal_code as item_code,
           COALESCE((SELECT SUM(amount) FROM payments WHERE rental_id = r.id), 0) as total_paid
         FROM rentals r 
         JOIN clients c ON r.client_id = c.id 
         JOIN items i ON r.item_id = i.id 
         WHERE r.id = ?`
      )
      .get(id) as RentalResponse | undefined;

    if (!row) {
      throw new NotFoundError('Aluguel');
    }

    return {
      ...row,
      observations: row.observations ? decrypt(row.observations) : null,
    };
  }

  complete(id: number, input?: CompleteRentalInput): RentalResponse {
    const db = getDatabase();
    const rental = this.findById(id);

    if (rental.status !== 'active' && rental.status !== 'overdue') {
      throw new ValidationError(`Aluguel não pode ser finalizado (status: ${rental.status})`);
    }

    const actualEndDate = input?.actual_end_date || localNow();
    const expectedEnd = new Date(rental.expected_end_date);
    const actualEnd = new Date(actualEndDate);

    // Calculate late fee per minute based on (rental_value / duration) * minutes_late
    let lateFee = 0;
    if (actualEnd > expectedEnd) {
      const minutesLate = Math.ceil((actualEnd.getTime() - expectedEnd.getTime()) / 60000);
      const durationMinutes = rental.pricing_duration_minutes || 60; // fallback 60 min
      const perMinuteRate = rental.rental_value / durationMinutes;
      lateFee = Math.round(perMinuteRate * minutesLate * 100) / 100;
    }

    const totalValue = rental.rental_value - rental.discount + lateFee;

    const transaction = db.transaction(() => {
      db.prepare(
        `UPDATE rentals 
         SET actual_end_date = ?, late_fee = ?, total_value = ?, status = 'completed', updated_at = datetime('now','localtime') 
         WHERE id = ?`
      ).run(actualEndDate, lateFee, totalValue, id);

      // Release item back to available
      db.prepare("UPDATE items SET status = 'available', updated_at = datetime('now','localtime') WHERE id = ?").run(
        rental.item_id
      );
    });

    transaction();
    return this.findById(id);
  }

  cancel(id: number): RentalResponse {
    const db = getDatabase();
    const rental = this.findById(id);

    if (rental.status === 'completed' || rental.status === 'cancelled') {
      throw new ValidationError(`Aluguel não pode ser cancelado (status: ${rental.status})`);
    }

    const transaction = db.transaction(() => {
      db.prepare(
        "UPDATE rentals SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(id);

      // Release item back to available
      db.prepare("UPDATE items SET status = 'available', updated_at = datetime('now','localtime') WHERE id = ?").run(
        rental.item_id
      );
    });

    transaction();
    return this.findById(id);
  }

  checkOverdueRentals(): number {
    const db = getDatabase();
    // Use local time string for comparison since expected_end_date comes from datetime-local input (local time)
    const now = localNow();

    const result = db
      .prepare(
        "UPDATE rentals SET status = 'overdue', updated_at = datetime('now','localtime') WHERE status = 'active' AND expected_end_date < ?"
      )
      .run(now);

    return result.changes;
  }

  private calculateRentalValue(
    unitValue: number,
    period: string,
    startDate: Date,
    endDate: Date
  ): number {
    const hours = diffInHours(startDate, endDate);

    switch (period) {
      case 'hour':
        return Math.ceil(hours) * unitValue;
      case 'day':
        return Math.ceil(hours / 24) * unitValue;
      case 'week':
        return Math.ceil(hours / (24 * 7)) * unitValue;
      case 'month':
        return Math.ceil(hours / (24 * 30)) * unitValue;
      default:
        return Math.ceil(hours) * unitValue;
    }
  }
}

export const rentalService = new RentalService();
