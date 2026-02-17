import { Request, Response } from 'express';
import { rentalService } from './rental.service';
import { AuthRequest } from '../../middlewares';
import { auditLogService } from '../../services/auditLog.service';
import { cashierService } from '../cashier/cashier.service';
import { getDatabase } from '../../database';

export class RentalController {
  create(req: AuthRequest, res: Response): void {
    const rental = rentalService.create(req.body);

    auditLogService.log({
      userId: req.userId,
      action: 'RENTAL_CREATE',
      resource: 'rental',
      resourceId: rental.id,
      details: `Aluguel criado: item ${rental.item_id} para cliente ${rental.client_id}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(rental);
  }

  findAll(req: Request, res: Response): void {
    const filters = {
      status: req.query.status as string | undefined,
      client_id: req.query.client_id ? Number(req.query.client_id) : undefined,
      item_id: req.query.item_id ? Number(req.query.item_id) : undefined,
    };
    const rentals = rentalService.findAll(filters);
    res.json(rentals);
  }

  findById(req: Request, res: Response): void {
    const rental = rentalService.findById(Number(req.params.id));
    res.json(rental);
  }

  complete(req: AuthRequest, res: Response): void {
    const rental = rentalService.complete(Number(req.params.id), req.body);

    auditLogService.log({
      userId: req.userId,
      action: 'RENTAL_COMPLETE',
      resource: 'rental',
      resourceId: rental.id,
      details: `Aluguel finalizado. Multa: ${rental.late_fee}, Total: ${rental.total_value}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(rental);
  }

  cancel(req: AuthRequest, res: Response): void {
    const rental = rentalService.cancel(Number(req.params.id));

    auditLogService.log({
      userId: req.userId,
      action: 'RENTAL_CANCEL',
      resource: 'rental',
      resourceId: rental.id,
      details: `Aluguel cancelado`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(rental);
  }

  checkOverdue(_req: Request, res: Response): void {
    const count = rentalService.checkOverdueRentals();
    res.json({ message: `${count} aluguel(éis) marcado(s) como atrasado(s)` });
  }

  sendToCashier(req: AuthRequest, res: Response): void {
    const rentalId = Number(req.params.id);
    const rental = rentalService.findById(rentalId);
    const { type } = req.body; // 'full' = total, 'deposit' = caução, 'payment' = pagamento

    // Check user has open register
    const openRegister = cashierService.getOpenRegister(req.userId!);
    if (!openRegister) {
      res.status(409).json({ error: true, message: 'Você não possui um caixa aberto. Abra um caixa antes.' });
      return;
    }

    const db = getDatabase();

    // Check what was already sent to cashier for this rental (non-cancelled transactions)
    const alreadySent = db.prepare(
      `SELECT category, SUM(CASE WHEN type = 'entry' THEN amount ELSE -amount END) as total
       FROM cash_transactions 
       WHERE reference_type = 'rental' AND reference_id = ? AND cancelled = 0
       GROUP BY category`
    ).all(rentalId) as { category: string; total: number }[];

    const alreadySentMap: Record<string, number> = {};
    for (const row of alreadySent) {
      alreadySentMap[row.category] = row.total;
    }

    const depositAlreadySent = alreadySentMap['deposit'] || 0;
    const paymentAlreadySent = alreadySentMap['rental_payment'] || 0;
    const discountAlreadySent = alreadySentMap['adjustment'] || 0;

    const entries: any[] = [];

    if (type === 'deposit' && rental.deposit > 0) {
      const remaining = rental.deposit - depositAlreadySent;
      if (remaining <= 0) {
        res.status(409).json({ error: true, message: 'Caução já foi totalmente enviada ao caixa.' });
        return;
      }
      entries.push(cashierService.createTransaction({
        cashRegisterId: openRegister.id,
        type: 'entry',
        category: 'deposit',
        amount: remaining,
        description: `Caução aluguel #${rentalId} - ${rental.item_name} (${rental.client_name})`,
        paymentMethod: req.body.payment_method || 'cash',
        referenceType: 'rental',
        referenceId: rentalId,
        userId: req.userId!,
      }));
    } else if (type === 'full') {
      // Calculate what still needs to be sent
      const totalPaid = rental.total_paid || 0;
      const paymentRemaining = totalPaid - paymentAlreadySent - depositAlreadySent;

      if (paymentRemaining > 0) {
        entries.push(cashierService.createTransaction({
          cashRegisterId: openRegister.id,
          type: 'entry',
          category: 'rental_payment',
          amount: paymentRemaining,
          description: `Pagamento aluguel #${rentalId} - ${rental.item_name} (${rental.client_name})`,
          paymentMethod: req.body.payment_method || 'cash',
          referenceType: 'rental',
          referenceId: rentalId,
          userId: req.userId!,
        }));
      }

      // Discount as exit (only if not already sent)
      const discountRemaining = rental.discount - Math.abs(discountAlreadySent);
      if (discountRemaining > 0) {
        entries.push(cashierService.createTransaction({
          cashRegisterId: openRegister.id,
          type: 'exit',
          category: 'adjustment',
          amount: discountRemaining,
          description: `Desconto aluguel #${rentalId} - ${rental.item_name}`,
          paymentMethod: null as any,
          referenceType: 'rental',
          referenceId: rentalId,
          userId: req.userId!,
        }));
      }

      if (entries.length === 0) {
        res.status(409).json({ error: true, message: 'Todos os valores deste aluguel já foram enviados ao caixa.' });
        return;
      }
    } else {
      // Send specific amount
      const amount = req.body.amount || 0;
      if (amount <= 0) {
        res.status(400).json({ error: true, message: 'Valor deve ser maior que zero.' });
        return;
      }
      entries.push(cashierService.createTransaction({
        cashRegisterId: openRegister.id,
        type: 'entry',
        category: 'rental_payment',
        amount,
        description: `Pagamento aluguel #${rentalId} - ${rental.item_name} (${rental.client_name})`,
        paymentMethod: req.body.payment_method || 'pix',
        referenceType: 'rental',
        referenceId: rentalId,
        userId: req.userId!,
      }));
    }

    auditLogService.log({
      userId: req.userId,
      action: 'RENTAL_TO_CASHIER',
      resource: 'rental',
      resourceId: rentalId,
      details: `Aluguel enviado ao caixa. ${entries.length} lançamento(s).`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: `${entries.length} lançamento(s) registrado(s) no caixa`, entries });
  }
}

export const rentalController = new RentalController();
