import { Router } from 'express';
import { cashierController } from './cashier.controller';
import { authMiddleware, requirePermission, validate } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

// ─── Caixa (Cash Register) ────────────────────────────────

// Abrir caixa
router.post(
  '/open',
  requirePermission(PERMISSIONS.CASHIER_OPEN),
  validate([
    { field: 'opening_balance', required: false, type: 'number', min: 0 },
  ]),
  (req, res) => {
    cashierController.open(req, res);
  }
);

// Meu caixa aberto
router.get('/my-open', requirePermission(PERMISSIONS.CASHIER_READ), (req, res) => {
  cashierController.getMyOpen(req, res);
});

// Relatório diário
router.get('/report/daily', requirePermission(PERMISSIONS.CASHIER_REPORT), (req, res) => {
  cashierController.getDailyReport(req, res);
});

// Relatório por período
router.get('/report/period', requirePermission(PERMISSIONS.CASHIER_REPORT), (req, res) => {
  cashierController.getPeriodReport(req, res);
});

// Listar transações (global, com filtros)
router.get('/transactions', requirePermission(PERMISSIONS.CASHIER_READ), (req, res) => {
  cashierController.findAllTransactions(req, res);
});

// Buscar transação por ID
router.get('/transactions/:id', requirePermission(PERMISSIONS.CASHIER_READ), (req, res) => {
  cashierController.findTransaction(req, res);
});

// Cancelar transação
router.patch(
  '/transactions/:id/cancel',
  requirePermission(PERMISSIONS.CASHIER_CANCEL),
  validate([
    { field: 'reason', required: true, type: 'string', minLength: 3 },
  ]),
  (req, res) => {
    cashierController.cancelTransaction(req, res);
  }
);

// Registrar entrada
router.post(
  '/entry',
  requirePermission(PERMISSIONS.CASHIER_ENTRY),
  validate([
    { field: 'cash_register_id', required: true, type: 'number' },
    { field: 'amount', required: true, type: 'number', min: 0.01 },
    { field: 'description', required: true, type: 'string', minLength: 2 },
  ]),
  (req, res) => {
    cashierController.createEntry(req, res);
  }
);

// Registrar saída
router.post(
  '/exit',
  requirePermission(PERMISSIONS.CASHIER_EXIT),
  validate([
    { field: 'cash_register_id', required: true, type: 'number' },
    { field: 'amount', required: true, type: 'number', min: 0.01 },
    { field: 'description', required: true, type: 'string', minLength: 2 },
  ]),
  (req, res) => {
    cashierController.createExit(req, res);
  }
);

// Listar caixas (histórico)
router.get('/', requirePermission(PERMISSIONS.CASHIER_READ), (req, res) => {
  cashierController.findAll(req, res);
});

// Buscar caixa por ID
router.get('/:id', requirePermission(PERMISSIONS.CASHIER_READ), (req, res) => {
  cashierController.findById(req, res);
});

// Resumo do caixa
router.get('/:id/summary', requirePermission(PERMISSIONS.CASHIER_READ), (req, res) => {
  cashierController.getSummary(req, res);
});

// Fechar caixa
router.post('/:id/close', requirePermission(PERMISSIONS.CASHIER_CLOSE), (req, res) => {
  cashierController.close(req, res);
});

export default router;
