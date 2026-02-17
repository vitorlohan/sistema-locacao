import { Router } from 'express';
import { reportController } from './report.controller';
import { authMiddleware, requirePermission } from '../../middlewares';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);
router.use(requirePermission(PERMISSIONS.REPORTS_READ));

// ─── Relatórios JSON ────────────────────────────────────

router.get('/dashboard', (req, res) => {
  reportController.getDashboard(req, res);
});

router.get('/revenue/daily', (req, res) => {
  reportController.getRevenueByDay(req, res);
});

router.get('/revenue/monthly', (req, res) => {
  reportController.getRevenueByMonth(req, res);
});

router.get('/revenue/period', (req, res) => {
  reportController.getRevenueByPeriod(req, res);
});

router.get('/top-items', (req, res) => {
  reportController.getTopItems(req, res);
});

router.get('/top-clients', (req, res) => {
  reportController.getTopClients(req, res);
});

router.get('/payment-methods', (req, res) => {
  reportController.getPaymentMethodStats(req, res);
});

router.get('/items/available', (req, res) => {
  reportController.getAvailableItems(req, res);
});

router.get('/items/maintenance', (req, res) => {
  reportController.getMaintenanceItems(req, res);
});

router.get('/rental-history', (req, res) => {
  reportController.getRentalHistory(req, res);
});

// ─── Exportação CSV ─────────────────────────────────────

router.get('/export/csv/top-items', (req, res) => {
  reportController.exportTopItemsCsv(req, res);
});

router.get('/export/csv/top-clients', (req, res) => {
  reportController.exportTopClientsCsv(req, res);
});

router.get('/export/csv/revenue', (req, res) => {
  reportController.exportRevenueCsv(req, res);
});

router.get('/export/csv/items-available', (req, res) => {
  reportController.exportAvailableItemsCsv(req, res);
});

router.get('/export/csv/items-maintenance', (req, res) => {
  reportController.exportMaintenanceItemsCsv(req, res);
});

router.get('/export/csv/rental-history', (req, res) => {
  reportController.exportRentalHistoryCsv(req, res);
});

// ─── Exportação PDF ─────────────────────────────────────

router.get('/export/pdf/top-items', (req, res, next) => {
  reportController.exportTopItemsPdf(req, res).catch(next);
});

router.get('/export/pdf/top-clients', (req, res, next) => {
  reportController.exportTopClientsPdf(req, res).catch(next);
});

router.get('/export/pdf/revenue', (req, res, next) => {
  reportController.exportRevenuePdf(req, res).catch(next);
});

router.get('/export/pdf/items-available', (req, res, next) => {
  reportController.exportAvailableItemsPdf(req, res).catch(next);
});

router.get('/export/pdf/items-maintenance', (req, res, next) => {
  reportController.exportMaintenanceItemsPdf(req, res).catch(next);
});

router.get('/export/pdf/rental-history', (req, res, next) => {
  reportController.exportRentalHistoryPdf(req, res).catch(next);
});

export default router;
