import { Request, Response } from 'express';
import { reportService } from './report.service';
import { generateCsv, generatePdf, fmtCurrency, fmtDate } from './export.service';

export class ReportController {
  getDashboard(_req: Request, res: Response): void {
    const data = reportService.getDashboard();
    res.json(data);
  }

  getRevenueByDay(req: Request, res: Response): void {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      res.status(400).json({ error: true, message: 'Informe start_date e end_date' });
      return;
    }
    const data = reportService.getRevenueByDay(start_date as string, end_date as string);
    res.json(data);
  }

  getRevenueByMonth(req: Request, res: Response): void {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = reportService.getRevenueByMonth(year);
    res.json(data);
  }

  getTopItems(req: Request, res: Response): void {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = reportService.getTopItems(limit);
    res.json(data);
  }

  getTopClients(req: Request, res: Response): void {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = reportService.getTopClients(limit);
    res.json(data);
  }

  getPaymentMethodStats(_req: Request, res: Response): void {
    const data = reportService.getPaymentMethodStats();
    res.json(data);
  }

  // ─── Novos relatórios ────────────────────────────────────

  getAvailableItems(_req: Request, res: Response): void {
    const data = reportService.getAvailableItems();
    res.json(data);
  }

  getMaintenanceItems(_req: Request, res: Response): void {
    const data = reportService.getMaintenanceItems();
    res.json(data);
  }

  getRentalHistory(req: Request, res: Response): void {
    const filters = {
      clientId: req.query.client_id ? Number(req.query.client_id) : undefined,
      itemId: req.query.item_id ? Number(req.query.item_id) : undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };
    const result = reportService.getRentalHistory(filters);
    res.json(result);
  }

  getRevenueByPeriod(req: Request, res: Response): void {
    const { start_date, end_date, group_by } = req.query;
    if (!start_date || !end_date) {
      res.status(400).json({ error: true, message: 'Informe start_date e end_date' });
      return;
    }
    const groupBy = (group_by as 'day' | 'week' | 'month') || 'day';
    const data = reportService.getRevenueByPeriod(start_date as string, end_date as string, groupBy);
    res.json(data);
  }

  // ─── Exportação CSV ──────────────────────────────────────

  exportTopItemsCsv(req: Request, res: Response): void {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = reportService.getTopItems(limit);

    const csv = generateCsv({
      title: 'Relatório - Itens Mais Alugados',
      columns: [
        { key: 'item_name', header: 'Item' },
        { key: 'internal_code', header: 'Código' },
        { key: 'rental_count', header: 'Qtd Aluguéis' },
        { key: 'total_revenue', header: 'Receita Total', format: (v) => fmtCurrency(v) },
      ],
      data,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="itens-mais-alugados.csv"');
    res.send(csv);
  }

  exportTopClientsCsv(req: Request, res: Response): void {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = reportService.getTopClients(limit);

    const csv = generateCsv({
      title: 'Relatório - Clientes Mais Frequentes',
      columns: [
        { key: 'client_name', header: 'Cliente' },
        { key: 'rental_count', header: 'Qtd Aluguéis' },
        { key: 'total_spent', header: 'Total Gasto', format: (v) => fmtCurrency(v) },
      ],
      data,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes-frequentes.csv"');
    res.send(csv);
  }

  exportRevenueCsv(req: Request, res: Response): void {
    const { start_date, end_date, group_by } = req.query;
    if (!start_date || !end_date) {
      res.status(400).json({ error: true, message: 'Informe start_date e end_date' });
      return;
    }
    const groupBy = (group_by as 'day' | 'week' | 'month') || 'day';
    const data = reportService.getRevenueByPeriod(start_date as string, end_date as string, groupBy);

    const csv = generateCsv({
      title: `Relatório - Receita por Período (${start_date} a ${end_date})`,
      columns: [
        { key: 'period', header: 'Período' },
        { key: 'total', header: 'Receita', format: (v) => fmtCurrency(v) },
        { key: 'count', header: 'Qtd Pagamentos' },
      ],
      data,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="receita-periodo.csv"');
    res.send(csv);
  }

  exportAvailableItemsCsv(_req: Request, res: Response): void {
    const data = reportService.getAvailableItems();

    const periodLabels: Record<string, string> = { hour: 'Hora', day: 'Dia', week: 'Semana', month: 'Mês' };

    const csv = generateCsv({
      title: 'Relatório - Itens Disponíveis',
      columns: [
        { key: 'internal_code', header: 'Código' },
        { key: 'name', header: 'Item' },
        { key: 'category', header: 'Categoria' },
        { key: 'rental_value', header: 'Valor Locação', format: (v) => fmtCurrency(v) },
        { key: 'rental_period', header: 'Período', format: (v) => periodLabels[v] || v },
      ],
      data,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="itens-disponiveis.csv"');
    res.send(csv);
  }

  exportMaintenanceItemsCsv(_req: Request, res: Response): void {
    const data = reportService.getMaintenanceItems();

    const csv = generateCsv({
      title: 'Relatório - Itens em Manutenção',
      columns: [
        { key: 'internal_code', header: 'Código' },
        { key: 'name', header: 'Item' },
        { key: 'category', header: 'Categoria' },
        { key: 'observations', header: 'Observações', format: (v) => v || '' },
      ],
      data,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="itens-manutencao.csv"');
    res.send(csv);
  }

  exportRentalHistoryCsv(req: Request, res: Response): void {
    const filters = {
      clientId: req.query.client_id ? Number(req.query.client_id) : undefined,
      itemId: req.query.item_id ? Number(req.query.item_id) : undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      limit: 5000,
    };
    const { data } = reportService.getRentalHistory(filters);

    const statusLabels: Record<string, string> = { active: 'Ativo', completed: 'Concluído', cancelled: 'Cancelado', overdue: 'Atrasado' };

    const csv = generateCsv({
      title: 'Relatório - Histórico de Aluguéis',
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'client_name', header: 'Cliente' },
        { key: 'item_name', header: 'Item' },
        { key: 'internal_code', header: 'Código' },
        { key: 'start_date', header: 'Início', format: fmtDate },
        { key: 'expected_end_date', header: 'Prev. Devolução', format: fmtDate },
        { key: 'actual_end_date', header: 'Devolvido em', format: fmtDate },
        { key: 'rental_value', header: 'Valor Locação', format: (v) => fmtCurrency(v) },
        { key: 'total_value', header: 'Valor Total', format: (v) => fmtCurrency(v) },
        { key: 'status', header: 'Status', format: (v) => statusLabels[v] || v },
      ],
      data,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="historico-alugueis.csv"');
    res.send(csv);
  }

  // ─── Exportação PDF ──────────────────────────────────────

  async exportTopItemsPdf(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = reportService.getTopItems(limit);

    const buf = await generatePdf({
      title: 'Itens Mais Alugados',
      subtitle: `Top ${limit} itens`,
      orientation: 'portrait',
      columns: [
        { key: 'item_name', header: 'Item', width: 180 },
        { key: 'internal_code', header: 'Código', width: 100 },
        { key: 'rental_count', header: 'Aluguéis', width: 80, align: 'center' },
        { key: 'total_revenue', header: 'Receita', width: 120, align: 'right', format: fmtCurrency },
      ],
      data,
      summary: [
        { label: 'Total de itens', value: String(data.length) },
        { label: 'Receita total', value: fmtCurrency(data.reduce((s, d) => s + (d.total_revenue || 0), 0)) },
      ],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="itens-mais-alugados.pdf"');
    res.send(buf);
  }

  async exportTopClientsPdf(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = reportService.getTopClients(limit);

    const buf = await generatePdf({
      title: 'Clientes Mais Frequentes',
      subtitle: `Top ${limit} clientes`,
      orientation: 'portrait',
      columns: [
        { key: 'client_name', header: 'Cliente', width: 220 },
        { key: 'rental_count', header: 'Aluguéis', width: 100, align: 'center' },
        { key: 'total_spent', header: 'Total Gasto', width: 130, align: 'right', format: fmtCurrency },
      ],
      data,
      summary: [
        { label: 'Total de clientes', value: String(data.length) },
        { label: 'Valor total', value: fmtCurrency(data.reduce((s, d) => s + (d.total_spent || 0), 0)) },
      ],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes-frequentes.pdf"');
    res.send(buf);
  }

  async exportRevenuePdf(req: Request, res: Response): Promise<void> {
    const { start_date, end_date, group_by } = req.query;
    if (!start_date || !end_date) {
      res.status(400).json({ error: true, message: 'Informe start_date e end_date' });
      return;
    }
    const groupBy = (group_by as 'day' | 'week' | 'month') || 'day';
    const data = reportService.getRevenueByPeriod(start_date as string, end_date as string, groupBy);

    const totalRevenue = data.reduce((s, d) => s + (d.total || 0), 0);
    const totalPayments = data.reduce((s, d) => s + (d.count || 0), 0);

    const buf = await generatePdf({
      title: 'Receita por Período',
      subtitle: `${fmtDate(start_date)} a ${fmtDate(end_date)} — Agrupado por ${groupBy === 'day' ? 'dia' : groupBy === 'week' ? 'semana' : 'mês'}`,
      orientation: 'portrait',
      columns: [
        { key: 'period', header: 'Período', width: 200 },
        { key: 'total', header: 'Receita', width: 150, align: 'right', format: fmtCurrency },
        { key: 'count', header: 'Pagamentos', width: 100, align: 'center' },
      ],
      data,
      summary: [
        { label: 'Período', value: `${start_date} a ${end_date}` },
        { label: 'Receita total', value: fmtCurrency(totalRevenue) },
        { label: 'Total de pagamentos', value: String(totalPayments) },
      ],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="receita-periodo.pdf"');
    res.send(buf);
  }

  async exportAvailableItemsPdf(_req: Request, res: Response): Promise<void> {
    const data = reportService.getAvailableItems();
    const periodLabels: Record<string, string> = { hour: 'Hora', day: 'Dia', week: 'Semana', month: 'Mês' };

    const buf = await generatePdf({
      title: 'Itens Disponíveis',
      subtitle: `${data.length} itens disponíveis para locação`,
      orientation: 'landscape',
      columns: [
        { key: 'internal_code', header: 'Código', width: 100 },
        { key: 'name', header: 'Item', width: 200 },
        { key: 'category', header: 'Categoria', width: 130 },
        { key: 'rental_value', header: 'Valor', width: 110, align: 'right', format: fmtCurrency },
        { key: 'rental_period', header: 'Período', width: 80, align: 'center', format: (v) => periodLabels[v] || v },
        { key: 'observations', header: 'Observações', width: 140, format: (v) => v || '-' },
      ],
      data,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="itens-disponiveis.pdf"');
    res.send(buf);
  }

  async exportMaintenanceItemsPdf(_req: Request, res: Response): Promise<void> {
    const data = reportService.getMaintenanceItems();

    const buf = await generatePdf({
      title: 'Itens em Manutenção',
      subtitle: `${data.length} itens em manutenção`,
      orientation: 'portrait',
      columns: [
        { key: 'internal_code', header: 'Código', width: 120 },
        { key: 'name', header: 'Item', width: 200 },
        { key: 'category', header: 'Categoria', width: 130 },
        { key: 'observations', header: 'Observações', width: 150, format: (v) => v || '-' },
      ],
      data,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="itens-manutencao.pdf"');
    res.send(buf);
  }

  async exportRentalHistoryPdf(req: Request, res: Response): Promise<void> {
    const filters = {
      clientId: req.query.client_id ? Number(req.query.client_id) : undefined,
      itemId: req.query.item_id ? Number(req.query.item_id) : undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      limit: 5000,
    };
    const { data, total } = reportService.getRentalHistory(filters);

    const statusLabels: Record<string, string> = { active: 'Ativo', completed: 'Concluído', cancelled: 'Cancelado', overdue: 'Atrasado' };

    const summaryItems = [
      { label: 'Total de registros', value: String(total) },
    ];
    if (filters.startDate) summaryItems.push({ label: 'De', value: fmtDate(filters.startDate) });
    if (filters.endDate) summaryItems.push({ label: 'Até', value: fmtDate(filters.endDate) });
    if (filters.status) summaryItems.push({ label: 'Status', value: statusLabels[filters.status] || filters.status });

    const buf = await generatePdf({
      title: 'Histórico de Aluguéis',
      subtitle: filters.startDate && filters.endDate
        ? `${fmtDate(filters.startDate)} a ${fmtDate(filters.endDate)}`
        : 'Todos os aluguéis',
      orientation: 'landscape',
      columns: [
        { key: 'id', header: 'ID', width: 40, align: 'center' },
        { key: 'client_name', header: 'Cliente', width: 140 },
        { key: 'item_name', header: 'Item', width: 130 },
        { key: 'internal_code', header: 'Código', width: 70 },
        { key: 'start_date', header: 'Início', width: 80, format: fmtDate },
        { key: 'expected_end_date', header: 'Prev. Dev.', width: 80, format: fmtDate },
        { key: 'actual_end_date', header: 'Devolvido', width: 80, format: fmtDate },
        { key: 'total_value', header: 'Total', width: 80, align: 'right', format: fmtCurrency },
        { key: 'status', header: 'Status', width: 70, align: 'center', format: (v) => statusLabels[v] || v },
      ],
      data,
      summary: summaryItems,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="historico-alugueis.pdf"');
    res.send(buf);
  }
}

export const reportController = new ReportController();
