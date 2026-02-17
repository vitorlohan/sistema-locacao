import { getDatabase } from '../../database';
import { AppError, NotFoundError, ValidationError } from '../../utils/errors';

// ─── Interfaces ──────────────────────────────────────────

interface OpenCashRegisterInput {
  userId: number;
  openingBalance: number;
  observations?: string;
}

interface CloseCashRegisterInput {
  registerId: number;
  userId: number;
  observations?: string;
}

interface CreateTransactionInput {
  cashRegisterId: number;
  type: 'entry' | 'exit';
  category: string;
  amount: number;
  description: string;
  paymentMethod?: string;
  referenceType?: string;
  referenceId?: number;
  userId: number;
}

interface CancelTransactionInput {
  transactionId: number;
  cancelledBy: number;
  reason: string;
}

interface CashRegisterFilters {
  userId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface TransactionFilters {
  cashRegisterId?: number;
  type?: string;
  category?: string;
  cancelled?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface DailyReport {
  date: string;
  registers: any[];
  totals: {
    opening_balance: number;
    closing_balance: number | null;
    total_entries: number;
    total_exits: number;
    net_movement: number;
    transaction_count: number;
    cancelled_count: number;
  };
}

// ─── Service ─────────────────────────────────────────────

export class CashierService {
  /**
   * Abre um novo caixa. Apenas um caixa aberto por operador é permitido.
   */
  open(input: OpenCashRegisterInput): any {
    const db = getDatabase();

    // Verificar se o operador já tem um caixa aberto
    const openRegister = db
      .prepare("SELECT id FROM cash_registers WHERE user_id = ? AND status = 'open'")
      .get(input.userId) as any;

    if (openRegister) {
      throw new AppError(
        `Operador já possui um caixa aberto (ID: ${openRegister.id}). Feche-o antes de abrir um novo.`,
        409
      );
    }

    if (input.openingBalance < 0) {
      throw new ValidationError('Saldo inicial não pode ser negativo');
    }

    const result = db
      .prepare(
        `INSERT INTO cash_registers (user_id, opening_balance, observations)
         VALUES (?, ?, ?)`
      )
      .run(input.userId, input.openingBalance, input.observations || null);

    return this.findById(result.lastInsertRowid as number);
  }

  /**
   * Fecha um caixa, calculando o saldo final automaticamente.
   */
  close(input: CloseCashRegisterInput): any {
    const db = getDatabase();

    const register = db
      .prepare('SELECT * FROM cash_registers WHERE id = ?')
      .get(input.registerId) as any;

    if (!register) {
      throw new NotFoundError('Caixa');
    }

    if (register.status === 'closed') {
      throw new AppError('Este caixa já está fechado', 409);
    }

    // Calcular totais a partir das transações
    const totals = db
      .prepare(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'entry' AND cancelled = 0 THEN amount ELSE 0 END), 0) as total_entries,
          COALESCE(SUM(CASE WHEN type = 'exit' AND cancelled = 0 THEN amount ELSE 0 END), 0) as total_exits
         FROM cash_transactions
         WHERE cash_register_id = ?`
      )
      .get(input.registerId) as { total_entries: number; total_exits: number };

    const closingBalance = register.opening_balance + totals.total_entries - totals.total_exits;

    db.prepare(
      `UPDATE cash_registers 
       SET status = 'closed', 
           closing_balance = ?, 
           total_entries = ?,
           total_exits = ?,
           observations = COALESCE(?, observations),
           closed_at = datetime('now','localtime'),
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      closingBalance,
      totals.total_entries,
      totals.total_exits,
      input.observations || null,
      input.registerId
    );

    return this.findById(input.registerId);
  }

  /**
   * Busca um caixa por ID, incluindo nome do operador.
   */
  findById(id: number): any {
    const db = getDatabase();

    const register = db
      .prepare(
        `SELECT cr.*, u.name as operator_name
         FROM cash_registers cr
         JOIN users u ON u.id = cr.user_id
         WHERE cr.id = ?`
      )
      .get(id) as any;

    if (!register) {
      throw new NotFoundError('Caixa');
    }

    return register;
  }

  /**
   * Lista caixas com filtros.
   */
  findAll(filters: CashRegisterFilters = {}): { data: any[]; total: number } {
    const db = getDatabase();
    let whereClauses = ['1=1'];
    const params: any[] = [];

    if (filters.userId) {
      whereClauses.push('cr.user_id = ?');
      params.push(filters.userId);
    }

    if (filters.status) {
      whereClauses.push('cr.status = ?');
      params.push(filters.status);
    }

    if (filters.startDate) {
      whereClauses.push('cr.opened_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('cr.opened_at <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }

    const where = whereClauses.join(' AND ');

    const total = (
      db
        .prepare(`SELECT COUNT(*) as count FROM cash_registers cr WHERE ${where}`)
        .get(...params) as any
    ).count;

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const data = db
      .prepare(
        `SELECT cr.*, u.name as operator_name
         FROM cash_registers cr
         JOIN users u ON u.id = cr.user_id
         WHERE ${where}
         ORDER BY cr.opened_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as any[];

    return { data, total };
  }

  /**
   * Retorna o caixa aberto do operador (se houver).
   */
  getOpenRegister(userId: number): any | null {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT cr.*, u.name as operator_name
         FROM cash_registers cr
         JOIN users u ON u.id = cr.user_id
         WHERE cr.user_id = ? AND cr.status = 'open'`
      )
      .get(userId) as any | null;
  }

  // ─── Transações ──────────────────────────────────────────

  /**
   * Registra uma entrada ou saída no caixa.
   */
  createTransaction(input: CreateTransactionInput): any {
    const db = getDatabase();

    // Verificar se o caixa existe e está aberto
    const register = db
      .prepare('SELECT * FROM cash_registers WHERE id = ?')
      .get(input.cashRegisterId) as any;

    if (!register) {
      throw new NotFoundError('Caixa');
    }

    if (register.status === 'closed') {
      throw new AppError('Não é possível registrar movimentação em um caixa fechado', 409);
    }

    if (input.amount <= 0) {
      throw new ValidationError('Valor deve ser maior que zero');
    }

    const result = db
      .prepare(
        `INSERT INTO cash_transactions 
         (cash_register_id, type, category, amount, description, payment_method, reference_type, reference_id, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.cashRegisterId,
        input.type,
        input.category,
        input.amount,
        input.description,
        input.paymentMethod || null,
        input.referenceType || null,
        input.referenceId || null,
        input.userId
      );

    return this.findTransactionById(result.lastInsertRowid as number);
  }

  /**
   * Cancela uma transação (soft delete).
   */
  cancelTransaction(input: CancelTransactionInput): any {
    const db = getDatabase();

    const transaction = this.findTransactionById(input.transactionId);

    if (transaction.cancelled) {
      throw new AppError('Esta transação já está cancelada', 409);
    }

    // Verificar se o caixa está aberto
    const register = db
      .prepare('SELECT status FROM cash_registers WHERE id = ?')
      .get(transaction.cash_register_id) as any;

    if (!register || register.status === 'closed') {
      throw new AppError('Não é possível cancelar transação de um caixa fechado', 409);
    }

    if (!input.reason || input.reason.trim().length < 3) {
      throw new ValidationError('Motivo do cancelamento é obrigatório (mínimo 3 caracteres)');
    }

    db.prepare(
      `UPDATE cash_transactions 
       SET cancelled = 1, cancelled_at = datetime('now','localtime'), cancelled_by = ?, cancellation_reason = ?
       WHERE id = ?`
    ).run(input.cancelledBy, input.reason, input.transactionId);

    return this.findTransactionById(input.transactionId);
  }

  /**
   * Busca uma transação por ID.
   */
  findTransactionById(id: number): any {
    const db = getDatabase();

    const transaction = db
      .prepare(
        `SELECT ct.*, u.name as user_name, cb.name as cancelled_by_name
         FROM cash_transactions ct
         JOIN users u ON u.id = ct.user_id
         LEFT JOIN users cb ON cb.id = ct.cancelled_by
         WHERE ct.id = ?`
      )
      .get(id) as any;

    if (!transaction) {
      throw new NotFoundError('Transação');
    }

    return transaction;
  }

  /**
   * Lista transações com filtros.
   */
  findAllTransactions(filters: TransactionFilters = {}): { data: any[]; total: number } {
    const db = getDatabase();
    let whereClauses = ['1=1'];
    const params: any[] = [];

    if (filters.cashRegisterId) {
      whereClauses.push('ct.cash_register_id = ?');
      params.push(filters.cashRegisterId);
    }

    if (filters.type) {
      whereClauses.push('ct.type = ?');
      params.push(filters.type);
    }

    if (filters.category) {
      whereClauses.push('ct.category = ?');
      params.push(filters.category);
    }

    if (filters.cancelled !== undefined) {
      whereClauses.push('ct.cancelled = ?');
      params.push(filters.cancelled ? 1 : 0);
    }

    if (filters.startDate) {
      whereClauses.push('ct.created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('ct.created_at <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }

    const where = whereClauses.join(' AND ');

    const total = (
      db
        .prepare(`SELECT COUNT(*) as count FROM cash_transactions ct WHERE ${where}`)
        .get(...params) as any
    ).count;

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const data = db
      .prepare(
        `SELECT ct.*, u.name as user_name, cb.name as cancelled_by_name
         FROM cash_transactions ct
         JOIN users u ON u.id = ct.user_id
         LEFT JOIN users cb ON cb.id = ct.cancelled_by
         WHERE ${where}
         ORDER BY ct.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as any[];

    return { data, total };
  }

  /**
   * Retorna o resumo de um caixa (saldos e transações).
   */
  getRegisterSummary(registerId: number): any {
    const register = this.findById(registerId);

    const db = getDatabase();

    const totals = db
      .prepare(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'entry' AND cancelled = 0 THEN amount ELSE 0 END), 0) as total_entries,
          COALESCE(SUM(CASE WHEN type = 'exit' AND cancelled = 0 THEN amount ELSE 0 END), 0) as total_exits,
          COUNT(CASE WHEN cancelled = 0 THEN 1 END) as active_transactions,
          COUNT(CASE WHEN cancelled = 1 THEN 1 END) as cancelled_transactions
         FROM cash_transactions
         WHERE cash_register_id = ?`
      )
      .get(registerId) as any;

    const byCategory = db
      .prepare(
        `SELECT type, category, 
          SUM(amount) as total, COUNT(*) as count
         FROM cash_transactions
         WHERE cash_register_id = ? AND cancelled = 0
         GROUP BY type, category
         ORDER BY type, category`
      )
      .all(registerId) as any[];

    const byPaymentMethod = db
      .prepare(
        `SELECT payment_method, type,
          SUM(amount) as total, COUNT(*) as count
         FROM cash_transactions
         WHERE cash_register_id = ? AND cancelled = 0 AND payment_method IS NOT NULL
         GROUP BY payment_method, type
         ORDER BY payment_method`
      )
      .all(registerId) as any[];

    const currentBalance = register.opening_balance + totals.total_entries - totals.total_exits;

    return {
      register,
      current_balance: currentBalance,
      totals: {
        entries: totals.total_entries,
        exits: totals.total_exits,
        net: totals.total_entries - totals.total_exits,
        active_transactions: totals.active_transactions,
        cancelled_transactions: totals.cancelled_transactions,
      },
      by_category: byCategory,
      by_payment_method: byPaymentMethod,
    };
  }

  // ─── Relatórios ──────────────────────────────────────────

  /**
   * Relatório diário: todos os caixas e transações de um dia específico.
   */
  getDailyReport(date: string): DailyReport {
    const db = getDatabase();

    const registers = db
      .prepare(
        `SELECT cr.*, u.name as operator_name
         FROM cash_registers cr
         JOIN users u ON u.id = cr.user_id
         WHERE date(cr.opened_at) = ?
         ORDER BY cr.opened_at ASC`
      )
      .all(date) as any[];

    let totalOpening = 0;
    let totalClosing: number | null = 0;
    let totalEntries = 0;
    let totalExits = 0;
    let transactionCount = 0;
    let cancelledCount = 0;

    for (const register of registers) {
      // Buscar transações deste caixa
      const transactions = db
        .prepare(
          `SELECT ct.*, u.name as user_name
           FROM cash_transactions ct
           JOIN users u ON u.id = ct.user_id
           WHERE ct.cash_register_id = ?
           ORDER BY ct.created_at ASC`
        )
        .all(register.id) as any[];

      register.transactions = transactions;

      totalOpening += register.opening_balance;
      if (register.closing_balance !== null) {
        totalClosing = (totalClosing || 0) + register.closing_balance;
      } else {
        totalClosing = null;
      }

      const active = transactions.filter((t: any) => !t.cancelled);
      const cancelled = transactions.filter((t: any) => t.cancelled);

      totalEntries += active
        .filter((t: any) => t.type === 'entry')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      totalExits += active
        .filter((t: any) => t.type === 'exit')
        .reduce((sum: number, t: any) => sum + t.amount, 0);

      transactionCount += active.length;
      cancelledCount += cancelled.length;
    }

    return {
      date,
      registers,
      totals: {
        opening_balance: totalOpening,
        closing_balance: totalClosing,
        total_entries: totalEntries,
        total_exits: totalExits,
        net_movement: totalEntries - totalExits,
        transaction_count: transactionCount,
        cancelled_count: cancelledCount,
      },
    };
  }

  /**
   * Relatório por período: resumo diário para um intervalo de datas.
   */
  getPeriodReport(startDate: string, endDate: string): any {
    const db = getDatabase();

    const dailySummary = db
      .prepare(
        `SELECT 
          date(cr.opened_at) as date,
          COUNT(DISTINCT cr.id) as registers_count,
          SUM(cr.opening_balance) as total_opening,
          SUM(CASE WHEN cr.status = 'closed' THEN cr.closing_balance ELSE NULL END) as total_closing,
          (SELECT COALESCE(SUM(ct.amount), 0) 
           FROM cash_transactions ct 
           WHERE ct.cash_register_id IN (
             SELECT id FROM cash_registers WHERE date(opened_at) = date(cr.opened_at)
           ) AND ct.type = 'entry' AND ct.cancelled = 0
          ) as total_entries,
          (SELECT COALESCE(SUM(ct.amount), 0) 
           FROM cash_transactions ct 
           WHERE ct.cash_register_id IN (
             SELECT id FROM cash_registers WHERE date(opened_at) = date(cr.opened_at)
           ) AND ct.type = 'exit' AND ct.cancelled = 0
          ) as total_exits
         FROM cash_registers cr
         WHERE date(cr.opened_at) BETWEEN ? AND ?
         GROUP BY date(cr.opened_at)
         ORDER BY date ASC`
      )
      .all(startDate, endDate) as any[];

    // Totais do período
    const periodTotals = {
      total_registers: dailySummary.reduce((s, d) => s + d.registers_count, 0),
      total_opening: dailySummary.reduce((s, d) => s + (d.total_opening || 0), 0),
      total_entries: dailySummary.reduce((s, d) => s + (d.total_entries || 0), 0),
      total_exits: dailySummary.reduce((s, d) => s + (d.total_exits || 0), 0),
      net_movement: 0,
      days_count: dailySummary.length,
    };
    periodTotals.net_movement = periodTotals.total_entries - periodTotals.total_exits;

    return {
      start_date: startDate,
      end_date: endDate,
      daily_summary: dailySummary,
      totals: periodTotals,
    };
  }
}

export const cashierService = new CashierService();
