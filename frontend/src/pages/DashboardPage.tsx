import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import type { Dashboard, TopItem, TopClient, RevenueByPeriod } from '../types';
import { fmtCurrency } from '../utils/helpers';
import {
  FiUsers, FiBox, FiCheckCircle, FiAlertTriangle,
  FiTool, FiFileText, FiDollarSign, FiTrendingUp,
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#7c3aed'];

export default function DashboardPage() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [revenue, setRevenue] = useState<RevenueByPeriod[]>([]);

  const load = useCallback(async () => {
    try {
      const [d, ti, tc, rv] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/top-items?limit=5'),
        api.get('/reports/top-clients?limit=5'),
        api.get('/reports/revenue/monthly'),
      ]);
      setDash(d.data);
      setTopItems(Array.isArray(ti.data) ? ti.data : []);
      setTopClients(Array.isArray(tc.data) ? tc.data : []);
      setRevenue(Array.isArray(rv.data) ? rv.data : []);
    } catch { /* toast shown by interceptor */ }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  if (!dash) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <>
      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon={<FiUsers />} color="blue" label="Clientes" value={dash.total_clients} />
        <StatCard icon={<FiBox />} color="cyan" label="Itens" value={dash.total_items} />
        <StatCard icon={<FiCheckCircle />} color="green" label="Disponíveis" value={dash.items_available} />
        <StatCard icon={<FiFileText />} color="blue" label="Aluguéis Ativos" value={dash.active_rentals} />
        <StatCard icon={<FiAlertTriangle />} color="orange" label="Atrasados" value={dash.overdue_rentals} />
        <StatCard icon={<FiTool />} color="red" label="Manutenção" value={dash.items_maintenance} />
        <StatCard icon={<FiDollarSign />} color="green" label="Receita Hoje" value={fmtCurrency(dash.revenue_today)} />
        <StatCard icon={<FiTrendingUp />} color="blue" label="Receita Mês" value={fmtCurrency(dash.revenue_month)} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3>Receita Mensal</h3></div>
          {revenue.length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v: number) => `R$${v}`} />
                <Tooltip formatter={(v) => fmtCurrency(v as number)} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>Itens Mais Alugados</h3></div>
          {topItems.length === 0 ? (
            <p style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={topItems} dataKey="rental_count" nameKey="item_name" cx="50%" cy="50%" outerRadius={90} label>
                  {topItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>Top 5 Itens</h3></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Item</th><th>Aluguéis</th><th>Receita</th></tr></thead>
              <tbody>
                {topItems.map((t) => (
                  <tr key={t.item_id}>
                    <td>{t.item_name}</td>
                    <td>{t.rental_count}</td>
                    <td>{fmtCurrency(t.total_revenue)}</td>
                  </tr>
                ))}
                {topItems.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#9ca3af' }}>Sem dados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Top 5 Clientes</h3></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Cliente</th><th>Aluguéis</th><th>Total Gasto</th></tr></thead>
              <tbody>
                {topClients.map((c) => (
                  <tr key={c.client_id}>
                    <td>{c.client_name}</td>
                    <td>{c.rental_count}</td>
                    <td>{fmtCurrency(c.total_spent)}</td>
                  </tr>
                ))}
                {topClients.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#9ca3af' }}>Sem dados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-info">
        <h4>{label}</h4>
        <p>{value}</p>
      </div>
    </div>
  );
}
