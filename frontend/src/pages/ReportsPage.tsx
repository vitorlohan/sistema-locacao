import { useState, useCallback } from 'react';
import api from '../services/api';
import type { TopItem, TopClient, RevenueByPeriod, Item } from '../types';
import { fmtCurrency, fmtDate, RENTAL_STATUS_LABELS, ITEM_STATUS_LABELS, RENTAL_PERIOD_LABELS } from '../utils/helpers';
import toast from 'react-hot-toast';
import { FiDownload, FiFileText, FiBarChart2, FiUsers, FiBox, FiTool, FiList } from 'react-icons/fi';

type Tab = 'top-items' | 'top-clients' | 'revenue' | 'available' | 'maintenance' | 'history';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'top-items', label: 'Itens Mais Alugados', icon: <FiBarChart2 /> },
  { key: 'top-clients', label: 'Clientes Frequentes', icon: <FiUsers /> },
  { key: 'revenue', label: 'Receita por Período', icon: <FiFileText /> },
  { key: 'available', label: 'Itens Disponíveis', icon: <FiBox /> },
  { key: 'maintenance', label: 'Itens em Manutenção', icon: <FiTool /> },
  { key: 'history', label: 'Histórico Aluguéis', icon: <FiList /> },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('top-items');
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'top-items' && <TopItemsReport />}
      {tab === 'top-clients' && <TopClientsReport />}
      {tab === 'revenue' && <RevenueReport />}
      {tab === 'available' && <AvailableReport />}
      {tab === 'maintenance' && <MaintenanceReport />}
      {tab === 'history' && <HistoryReport />}
    </>
  );
}

/* ───── Export helpers ───── */
async function downloadFile(url: string, filename: string) {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([res.data]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${filename} baixado`);
  } catch { toast.error('Erro ao exportar'); }
}

function ExportButtons({ csvUrl, pdfUrl, name }: { csvUrl: string; pdfUrl: string; name: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="btn btn-sm btn-outline" onClick={() => downloadFile(csvUrl, `${name}.csv`)}><FiDownload /> CSV</button>
      <button className="btn btn-sm btn-danger" onClick={() => downloadFile(pdfUrl, `${name}.pdf`)}><FiDownload /> PDF</button>
    </div>
  );
}

/* ───── Top Items ───── */
function TopItemsReport() {
  const [data, setData] = useState<TopItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [limit, setLimit] = useState(10);

  const load = useCallback(async () => {
    const r = await api.get('/reports/top-items', { params: { limit } });
    setData(Array.isArray(r.data) ? r.data : []);
    setLoaded(true);
  }, [limit]);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Itens Mais Alugados</h3>
        <ExportButtons csvUrl={`/reports/export/csv/top-items?limit=${limit}`} pdfUrl={`/reports/export/pdf/top-items?limit=${limit}`} name="itens-mais-alugados" />
      </div>
      <div className="toolbar">
        <select className="form-control" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option><option value={50}>Top 50</option>
        </select>
        <button className="btn btn-primary" onClick={load}>Gerar Relatório</button>
      </div>
      {loaded && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Item</th><th>Código</th><th>Aluguéis</th><th>Receita Total</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>Sem dados</td></tr> :
                data.map((d) => (
                  <tr key={d.item_id}><td>{d.item_name}</td><td>{d.internal_code}</td><td>{d.rental_count}</td><td>{fmtCurrency(d.total_revenue)}</td></tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Top Clients ───── */
function TopClientsReport() {
  const [data, setData] = useState<TopClient[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [limit, setLimit] = useState(10);

  const load = useCallback(async () => {
    const r = await api.get('/reports/top-clients', { params: { limit } });
    setData(Array.isArray(r.data) ? r.data : []);
    setLoaded(true);
  }, [limit]);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Clientes Mais Frequentes</h3>
        <ExportButtons csvUrl={`/reports/export/csv/top-clients?limit=${limit}`} pdfUrl={`/reports/export/pdf/top-clients?limit=${limit}`} name="clientes-frequentes" />
      </div>
      <div className="toolbar">
        <select className="form-control" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option>
        </select>
        <button className="btn btn-primary" onClick={load}>Gerar Relatório</button>
      </div>
      {loaded && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Cliente</th><th>Aluguéis</th><th>Total Gasto</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>Sem dados</td></tr> :
                data.map((d) => (
                  <tr key={d.client_id}><td>{d.client_name}</td><td>{d.rental_count}</td><td>{fmtCurrency(d.total_spent)}</td></tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Revenue ───── */
function RevenueReport() {
  const [data, setData] = useState<RevenueByPeriod[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState('month');

  const qs = `start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`;

  const load = useCallback(async () => {
    const r = await api.get('/reports/revenue/period', { params: { start_date: startDate, end_date: endDate, group_by: groupBy } });
    setData(Array.isArray(r.data) ? r.data : [r.data]);
    setLoaded(true);
  }, [startDate, endDate, groupBy]);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Receita por Período</h3>
        <ExportButtons csvUrl={`/reports/export/csv/revenue?${qs}`} pdfUrl={`/reports/export/pdf/revenue?${qs}`} name="receita-periodo" />
      </div>
      <div className="toolbar">
        <input className="form-control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className="form-control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select className="form-control" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option>
        </select>
        <button className="btn btn-primary" onClick={load}>Gerar Relatório</button>
      </div>
      {loaded && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Período</th><th>Receita</th><th>Nº Pagamentos</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>Sem dados</td></tr> :
                data.map((d, i) => (
                  <tr key={i}><td>{d.period}</td><td>{fmtCurrency(d.total)}</td><td>{d.count}</td></tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Available Items ───── */
function AvailableReport() {
  const [data, setData] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/reports/items/available');
    setData(Array.isArray(r.data) ? r.data : []);
    setLoaded(true);
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Itens Disponíveis</h3>
        <ExportButtons csvUrl="/reports/export/csv/items-available" pdfUrl="/reports/export/pdf/items-available" name="itens-disponiveis" />
      </div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={load}>Carregar</button>
      </div>
      {loaded && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th>Valor</th><th>Período</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center' }}>Nenhum item disponível</td></tr> :
                data.map((d) => (
                  <tr key={d.id}><td>{d.internal_code}</td><td>{d.name}</td><td>{d.category}</td><td>{fmtCurrency(d.rental_value)}</td><td>{RENTAL_PERIOD_LABELS[d.rental_period]}</td></tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Maintenance Items ───── */
function MaintenanceReport() {
  const [data, setData] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get('/reports/items/maintenance');
    setData(Array.isArray(r.data) ? r.data : []);
    setLoaded(true);
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Itens em Manutenção</h3>
        <ExportButtons csvUrl="/reports/export/csv/items-maintenance" pdfUrl="/reports/export/pdf/items-maintenance" name="itens-manutencao" />
      </div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={load}>Carregar</button>
      </div>
      {loaded && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th>Status</th><th>Observações</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center' }}>Nenhum item em manutenção</td></tr> :
                data.map((d) => (
                  <tr key={d.id}><td>{d.internal_code}</td><td>{d.name}</td><td>{d.category}</td><td>{ITEM_STATUS_LABELS[d.status]}</td><td>{d.observations || '-'}</td></tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Rental History ───── */
function HistoryReport() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const qs = `status=${status}&start_date=${startDate}&end_date=${endDate}&limit=${limit}&offset=${page * limit}`;

  const load = useCallback(async () => {
    const r = await api.get('/reports/rental-history', { params: { status: status || undefined, start_date: startDate || undefined, end_date: endDate || undefined, limit, offset: page * limit } });
    setData(r.data.data ?? []);
    setTotal(r.data.total ?? 0);
    setLoaded(true);
  }, [status, startDate, endDate, page]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Histórico de Aluguéis ({total})</h3>
        <ExportButtons csvUrl={`/reports/export/csv/rental-history?${qs}`} pdfUrl={`/reports/export/pdf/rental-history?${qs}`} name="historico-alugueis" />
      </div>
      <div className="toolbar">
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos status</option>
          <option value="active">Ativo</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
          <option value="overdue">Atrasado</option>
        </select>
        <input className="form-control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="De" />
        <input className="form-control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="Até" />
        <button className="btn btn-primary" onClick={load}>Gerar Relatório</button>
      </div>
      {loaded && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Item</th><th>Início</th><th>Prev. Dev.</th><th>Devolvido</th><th>Valor</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center' }}>Sem dados</td></tr> :
                  data.map((d: any) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>{d.client_name}</td>
                      <td>{d.item_name}</td>
                      <td>{fmtDate(d.start_date)}</td>
                      <td>{fmtDate(d.expected_end_date)}</td>
                      <td>{fmtDate(d.actual_end_date)}</td>
                      <td>{fmtCurrency(d.total_value)}</td>
                      <td><span className={`badge ${d.status === 'active' ? 'badge-success' : d.status === 'overdue' ? 'badge-warning' : d.status === 'cancelled' ? 'badge-danger' : 'badge-gray'}`}>{RENTAL_STATUS_LABELS[d.status] ?? d.status}</span></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm btn-outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</button>
              <span style={{ fontSize: '.85rem' }}>Página {page + 1} de {pages}</span>
              <button className="btn btn-sm btn-outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
