import { getDatabase } from '../../database';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { encrypt, decrypt, localNow } from '../../utils';

interface CreatePaymentInput {
  rental_id: number;
  amount: number;
  payment_method: string;
  payment_date?: string;
  notes?: string;
}

interface PaymentRow {
  id: number;
  rental_id: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

interface PaymentResponse extends PaymentRow {
  client_name?: string;
  item_name?: string;
}

export class PaymentService {
  create(input: CreatePaymentInput): PaymentResponse {
    const db = getDatabase();

    // Verify rental exists
    const rental = db.prepare('SELECT id, status, total_value FROM rentals WHERE id = ?').get(input.rental_id) as any;
    if (!rental) throw new NotFoundError('Aluguel');

    // Calculate already paid
    const paid = db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE rental_id = ?')
      .get(input.rental_id) as { total: number };

    const remaining = rental.total_value - paid.total;
    if (input.amount > remaining + 0.01) {
      throw new ValidationError(
        `Valor excede o saldo restante. Total: R$${rental.total_value.toFixed(2)}, Pago: R$${paid.total.toFixed(2)}, Restante: R$${remaining.toFixed(2)}`
      );
    }

    const result = db
      .prepare(
        `INSERT INTO payments (rental_id, amount, payment_method, payment_date, notes) 
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.rental_id,
        input.amount,
        input.payment_method,
        input.payment_date || localNow().replace('T', ' '),
        input.notes ? encrypt(input.notes) : null
      );

    return this.findById(result.lastInsertRowid as number);
  }

  findAll(filters?: { rental_id?: number; payment_method?: string }): PaymentResponse[] {
    const db = getDatabase();
    let sql = `
      SELECT p.*, c.name as client_name, i.name as item_name 
      FROM payments p 
      JOIN rentals r ON p.rental_id = r.id 
      JOIN clients c ON r.client_id = c.id 
      JOIN items i ON r.item_id = i.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.rental_id) {
      sql += ' AND p.rental_id = ?';
      params.push(filters.rental_id);
    }
    if (filters?.payment_method) {
      sql += ' AND p.payment_method = ?';
      params.push(filters.payment_method);
    }

    sql += ' ORDER BY p.payment_date DESC';

    const rows = db.prepare(sql).all(...params) as PaymentResponse[];
    return rows.map((row) => ({
      ...row,
      notes: row.notes ? decrypt(row.notes) : null,
    }));
  }

  findById(id: number): PaymentResponse {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT p.*, c.name as client_name, i.name as item_name 
         FROM payments p 
         JOIN rentals r ON p.rental_id = r.id 
         JOIN clients c ON r.client_id = c.id 
         JOIN items i ON r.item_id = i.id 
         WHERE p.id = ?`
      )
      .get(id) as PaymentResponse | undefined;

    if (!row) {
      throw new NotFoundError('Pagamento');
    }

    return {
      ...row,
      notes: row.notes ? decrypt(row.notes) : null,
    };
  }

  getBalanceByRental(rentalId: number): { total_value: number; total_paid: number; remaining: number } {
    const db = getDatabase();

    const rental = db.prepare('SELECT total_value FROM rentals WHERE id = ?').get(rentalId) as any;
    if (!rental) throw new NotFoundError('Aluguel');

    const paid = db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE rental_id = ?')
      .get(rentalId) as { total: number };

    return {
      total_value: rental.total_value,
      total_paid: paid.total,
      remaining: rental.total_value - paid.total,
    };
  }

  delete(id: number): void {
    const db = getDatabase();
    const payment = db.prepare('SELECT id FROM payments WHERE id = ?').get(id);
    if (!payment) throw new NotFoundError('Pagamento');
    db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  }
}

export const paymentService = new PaymentService();
