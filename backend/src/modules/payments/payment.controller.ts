import { Request, Response } from 'express';
import { paymentService } from './payment.service';
import { AuthRequest } from '../../middlewares';
import { auditLogService } from '../../services/auditLog.service';

export class PaymentController {
  create(req: AuthRequest, res: Response): void {
    const payment = paymentService.create(req.body);

    auditLogService.log({
      userId: req.userId,
      action: 'PAYMENT_CREATE',
      resource: 'payment',
      resourceId: payment.id,
      details: `Pagamento R$${payment.amount} (${payment.payment_method}) para aluguel ${payment.rental_id}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(payment);
  }

  findAll(req: Request, res: Response): void {
    const filters = {
      rental_id: req.query.rental_id ? Number(req.query.rental_id) : undefined,
      payment_method: req.query.payment_method as string | undefined,
    };
    const payments = paymentService.findAll(filters);
    res.json(payments);
  }

  findById(req: Request, res: Response): void {
    const payment = paymentService.findById(Number(req.params.id));
    res.json(payment);
  }

  getBalance(req: Request, res: Response): void {
    const balance = paymentService.getBalanceByRental(Number(req.params.rentalId));
    res.json(balance);
  }

  delete(req: AuthRequest, res: Response): void {
    const payment = paymentService.findById(Number(req.params.id));

    auditLogService.log({
      userId: req.userId,
      action: 'PAYMENT_DELETE',
      resource: 'payment',
      resourceId: payment.id,
      details: `Pagamento R$${payment.amount} removido do aluguel ${payment.rental_id}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    paymentService.delete(Number(req.params.id));
    res.status(204).send();
  }
}

export const paymentController = new PaymentController();
