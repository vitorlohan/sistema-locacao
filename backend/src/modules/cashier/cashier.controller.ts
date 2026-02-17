import { Request, Response } from 'express';
import { cashierService } from './cashier.service';
import { AuthRequest } from '../../middlewares';
import { auditLogService } from '../../services/auditLog.service';

export class CashierController {
  // ─── Caixa ───────────────────────────────────────────────

  open(req: AuthRequest, res: Response): void {
    const { opening_balance, observations } = req.body;
    const register = cashierService.open({
      userId: req.userId!,
      openingBalance: opening_balance || 0,
      observations,
    });

    auditLogService.log({
      userId: req.userId,
      action: 'CASHIER_OPEN',
      resource: 'cash_register',
      resourceId: register.id,
      details: `Caixa aberto com saldo inicial R$${(opening_balance || 0).toFixed(2)}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(register);
  }

  close(req: AuthRequest, res: Response): void {
    const registerId = Number(req.params.id);
    const { observations } = req.body;

    const register = cashierService.close({
      registerId,
      userId: req.userId!,
      observations,
    });

    auditLogService.log({
      userId: req.userId,
      action: 'CASHIER_CLOSE',
      resource: 'cash_register',
      resourceId: register.id,
      details: `Caixa fechado. Saldo final: R$${register.closing_balance?.toFixed(2)}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(register);
  }

  findAll(req: AuthRequest, res: Response): void {
    const filters = {
      userId: req.query.user_id ? Number(req.query.user_id) : undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };
    const result = cashierService.findAll(filters);
    res.json(result);
  }

  findById(req: AuthRequest, res: Response): void {
    const register = cashierService.findById(Number(req.params.id));
    res.json(register);
  }

  getMyOpen(req: AuthRequest, res: Response): void {
    const register = cashierService.getOpenRegister(req.userId!);
    if (!register) {
      res.json({ open: false, register: null });
      return;
    }
    res.json({ open: true, register });
  }

  getSummary(req: AuthRequest, res: Response): void {
    const summary = cashierService.getRegisterSummary(Number(req.params.id));
    res.json(summary);
  }

  // ─── Transações ──────────────────────────────────────────

  createEntry(req: AuthRequest, res: Response): void {
    const { cash_register_id, category, amount, description, payment_method, reference_type, reference_id } = req.body;

    const transaction = cashierService.createTransaction({
      cashRegisterId: cash_register_id,
      type: 'entry',
      category: category || 'other',
      amount,
      description,
      paymentMethod: payment_method,
      referenceType: reference_type,
      referenceId: reference_id,
      userId: req.userId!,
    });

    auditLogService.log({
      userId: req.userId,
      action: 'CASHIER_ENTRY',
      resource: 'cash_transaction',
      resourceId: transaction.id,
      details: `Entrada R$${amount.toFixed(2)} - ${description}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(transaction);
  }

  createExit(req: AuthRequest, res: Response): void {
    const { cash_register_id, category, amount, description, payment_method, reference_type, reference_id } = req.body;

    const transaction = cashierService.createTransaction({
      cashRegisterId: cash_register_id,
      type: 'exit',
      category: category || 'other',
      amount,
      description,
      paymentMethod: payment_method,
      referenceType: reference_type,
      referenceId: reference_id,
      userId: req.userId!,
    });

    auditLogService.log({
      userId: req.userId,
      action: 'CASHIER_EXIT',
      resource: 'cash_transaction',
      resourceId: transaction.id,
      details: `Saída R$${amount.toFixed(2)} - ${description}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(transaction);
  }

  cancelTransaction(req: AuthRequest, res: Response): void {
    const transactionId = Number(req.params.id);
    const { reason } = req.body;

    const transaction = cashierService.cancelTransaction({
      transactionId,
      cancelledBy: req.userId!,
      reason,
    });

    auditLogService.log({
      userId: req.userId,
      action: 'CASHIER_CANCEL',
      resource: 'cash_transaction',
      resourceId: transaction.id,
      details: `Transação cancelada: ${reason}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(transaction);
  }

  findTransaction(req: AuthRequest, res: Response): void {
    const transaction = cashierService.findTransactionById(Number(req.params.id));
    res.json(transaction);
  }

  findAllTransactions(req: AuthRequest, res: Response): void {
    const filters = {
      cashRegisterId: req.query.cash_register_id ? Number(req.query.cash_register_id) : undefined,
      type: req.query.type as string | undefined,
      category: req.query.category as string | undefined,
      cancelled: req.query.cancelled !== undefined ? req.query.cancelled === 'true' : undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };
    const result = cashierService.findAllTransactions(filters);
    res.json(result);
  }

  // ─── Relatórios ──────────────────────────────────────────

  getDailyReport(req: AuthRequest, res: Response): void {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const report = cashierService.getDailyReport(date);
    res.json(report);
  }

  getPeriodReport(req: AuthRequest, res: Response): void {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!startDate || !endDate) {
      res.status(400).json({ error: true, message: 'start_date e end_date são obrigatórios' });
      return;
    }

    const report = cashierService.getPeriodReport(startDate, endDate);
    res.json(report);
  }
}

export const cashierController = new CashierController();
