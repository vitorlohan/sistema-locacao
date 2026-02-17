import { useEffect, useState, useCallback, type FormEvent } from 'react';
import api from '../services/api';
import type { CashRegister, CashTransaction, CashSummary } from '../types';
import { fmtCurrency, fmtDateTime, PAYMENT_METHOD_LABELS, statusBadgeClass } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { FiPlay, FiSquare, FiArrowUpCircle, FiArrowDownCircle, FiEye, FiXCircle, FiCalendar } from 'react-icons/fi';

const TX_CATEGORY_LABELS: Record<string, string> = {
  rental_payment: 'Pagamento Aluguel', deposit: 'Caução', refund: 'Reembolso', expense: 'Despesa',
  adjustment: 'Ajuste', withdrawal: 'Retirada', supply: 'Suprimento', other: 'Outro',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CashierPage() {
  const [myOpen, setMyOpen] = useState<CashRegister | null>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr());

  /* Open register modal */
  const [openModal, setOpenModal] = useState(false);
  const [openBalance, setOpenBalance] = useState(0);
  const [openObs, setOpenObs] = useState('');

  /* Entry/Exit modal */
  const [txModal, setTxModal] = useState<'entry' | 'exit' | null>(null);
  const [txForm, setTxForm] = useState({ amount: 0, description: '', category: 'other', payment_method: 'cash' });
  const [saving, setSaving] = useState(false);

  /* Close confirm */
  const [closingConfirm, setClosingConfirm] = useState(false);
  const [closeObs, setCloseObs] = useState('');

  /* Cancel tx */
  const [cancelTx, setCancelTx] = useState<CashTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  /* Summary modal */
  const [viewSummary, setViewSummary] = useState<CashSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, listRes] = await Promise.all([
        api.get('/cashier/my-open'),
        api.get('/cashier', { params: { start_date: filterDate || undefined, end_date: filterDate || undefined, limit: 50 } }),
      ]);
      const reg = myRes.data.open ? myRes.data.register : null;
      setMyOpen(reg);
      setRegisters(Array.isArray(listRes.data.data) ? listRes.data.data : Array.isArray(listRes.data) ? listRes.data : []);

      if (reg) {
        const [sumRes, txRes] = await Promise.all([
          api.get(`/cashier/${reg.id}/summary`),
          api.get('/cashier/transactions', { params: { cash_register_id: reg.id, limit: 200 } }),
        ]);
        setSummary(sumRes.data);
        setTransactions(Array.isArray(txRes.data.data) ? txRes.data.data : []);
      } else {
        setSummary(null);
        setTransactions([]);
      }
    } finally { setLoading(false); }
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  async function handleOpen(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/cashier/open', { opening_balance: openBalance, observations: openObs || undefined });
      toast.success('Caixa aberto');
      setOpenModal(false);
      load();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function handleClose() {
    if (!myOpen) return;
    setSaving(true);
    try {
      await api.post(`/cashier/${myOpen.id}/close`, { observations: closeObs || undefined });
      toast.success('Caixa fechado');
      setClosingConfirm(false);
      load();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function handleTx(e: FormEvent) {
    e.preventDefault();
    if (!myOpen || !txModal) return;
    if (txForm.amount <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    if (txForm.description.length < 2) { toast.error('Descrição obrigatória'); return; }
    setSaving(true);
    try {
      await api.post(`/cashier/${txModal}`, {
        cash_register_id: myOpen.id,
        amount: txForm.amount,
        description: txForm.description,
        category: txForm.category,
        payment_method: txForm.payment_method,
      });
      toast.success(txModal === 'entry' ? 'Entrada registrada' : 'Saída registrada');
      setTxModal(null);
      load();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function handleCancelTx() {
    if (!cancelTx || cancelReason.length < 3) { toast.error('Motivo obrigatório (min 3 caracteres)'); return; }
    try {
      await api.patch(`/cashier/transactions/${cancelTx.id}/cancel`, { reason: cancelReason });
      toast.success('Transação cancelada');
      setCancelTx(null);
      setCancelReason('');
      load();
    } catch { /* */ }
  }

  async function showSummary(reg: CashRegister) {
    try {
      const { data } = await api.get(`/cashier/${reg.id}/summary`);
      setViewSummary(data);
    } catch { /* toast shown by interceptor */ }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <>
      {/* Status */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className={`stat-icon ${myOpen ? 'green' : 'red'}`}>{myOpen ? <FiPlay /> : <FiSquare />}</div>
          <div className="stat-info">
            <h4>Status</h4>
            <p>{myOpen ? 'Caixa Aberto' : 'Caixa Fechado'}</p>
          </div>
        </div>
        {summary && (
          <>
            <div className="stat-card">
              <div className="stat-icon green"><FiArrowUpCircle /></div>
              <div className="stat-info"><h4>Entradas</h4><p>{fmtCurrency(summary.totals.entries)}</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><FiArrowDownCircle /></div>
              <div className="stat-info"><h4>Saídas</h4><p>{fmtCurrency(summary.totals.exits)}</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><FiEye /></div>
              <div className="stat-info"><h4>Saldo Atual</h4><p>{fmtCurrency(summary.current_balance)}</p></div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {!myOpen ? (
          <button className="btn btn-success" onClick={() => { setOpenBalance(0); setOpenObs(''); setOpenModal(true); }}><FiPlay /> Abrir Caixa</button>
        ) : (
          <>
            <button className="btn btn-success" onClick={() => { setTxForm({ amount: 0, description: '', category: 'other', payment_method: 'cash' }); setTxModal('entry'); }}><FiArrowUpCircle /> Entrada</button>
            <button className="btn btn-warning" onClick={() => { setTxForm({ amount: 0, description: '', category: 'other', payment_method: 'cash' }); setTxModal('exit'); }}><FiArrowDownCircle /> Saída</button>
            <button className="btn btn-danger" onClick={() => { setCloseObs(''); setClosingConfirm(true); }}><FiSquare /> Fechar Caixa</button>
          </>
        )}
      </div>

      {/* Current transactions */}
      {myOpen && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>Transações do Caixa Atual</h3></div>
          {transactions.length === 0 ? (
            <div className="empty-state"><p>Nenhuma transação</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Hora</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Forma</th><th>Valor</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={tx.cancelled ? { opacity: .5, textDecoration: 'line-through' } : {}}>
                      <td>{fmtDateTime(tx.created_at)}</td>
                      <td><span className={`badge ${tx.type === 'entry' ? 'badge-success' : 'badge-danger'}`}>{tx.type === 'entry' ? 'Entrada' : 'Saída'}</span></td>
                      <td>{TX_CATEGORY_LABELS[tx.category] ?? tx.category}</td>
                      <td>{tx.description}</td>
                      <td>{PAYMENT_METHOD_LABELS[tx.payment_method] ?? tx.payment_method}</td>
                      <td style={{ color: tx.type === 'entry' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{tx.type === 'entry' ? '+' : '-'}{fmtCurrency(tx.amount)}</td>
                      <td>{tx.cancelled ? <span className="badge badge-danger">Cancelada</span> : <span className="badge badge-success">OK</span>}</td>
                      <td>{!tx.cancelled && <button className="btn btn-sm btn-outline" onClick={() => { setCancelTx(tx); setCancelReason(''); }} title="Cancelar"><FiXCircle /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="card">
        <div className="card-header">
          <h3>Histórico de Caixas</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiCalendar style={{ color: '#6b7280' }} />
            <input type="date" className="form-control" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: 170 }} />
            {filterDate !== todayStr() && (
              <button className="btn btn-sm btn-outline" onClick={() => setFilterDate(todayStr())}>Hoje</button>
            )}
          </div>
        </div>
        {registers.length === 0 ? (
          <div className="empty-state"><p>Nenhum registro</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Abertura</th><th>Fechamento</th><th>Saldo Inicial</th><th>Entradas</th><th>Saídas</th><th>Saldo Final</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {registers.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{fmtDateTime(r.opened_at)}</td>
                    <td>{fmtDateTime(r.closed_at)}</td>
                    <td>{fmtCurrency(r.opening_balance)}</td>
                    <td style={{ color: '#16a34a' }}>{fmtCurrency(r.total_entries)}</td>
                    <td style={{ color: '#dc2626' }}>{fmtCurrency(r.total_exits)}</td>
                    <td>{r.closing_balance != null ? fmtCurrency(r.closing_balance) : '-'}</td>
                    <td><span className={`badge ${statusBadgeClass(r.status)}`}>{r.status === 'open' ? 'Aberto' : 'Fechado'}</span></td>
                    <td><button className="btn btn-sm btn-outline" onClick={() => showSummary(r)} title="Resumo"><FiEye /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Modal */}
      {openModal && (
        <Modal title="Abrir Caixa" onClose={() => setOpenModal(false)}>
          <form onSubmit={handleOpen}>
            <div className="form-group">
              <label>Saldo Inicial (R$)</label>
              <input className="form-control" type="number" min={0} step={0.01} value={openBalance} onChange={(e) => setOpenBalance(Number(e.target.value))} autoFocus />
            </div>
            <div className="form-group">
              <label>Observações</label>
              <textarea className="form-control" rows={2} value={openObs} onChange={(e) => setOpenObs(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setOpenModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Abrindo...' : 'Abrir Caixa'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* TX Modal */}
      {txModal && (
        <Modal title={txModal === 'entry' ? 'Nova Entrada' : 'Nova Saída'} onClose={() => setTxModal(null)}>
          <form onSubmit={handleTx}>
            <div className="form-row">
              <div className="form-group">
                <label>Valor (R$) *</label>
                <input className="form-control" type="number" min={0.01} step={0.01} value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: Number(e.target.value) }))} autoFocus />
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <select className="form-control" value={txForm.category} onChange={(e) => setTxForm((p) => ({ ...p, category: e.target.value }))}>
                  {Object.entries(TX_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Descrição *</label>
              <input className="form-control" value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Forma de Pagamento</label>
              <select className="form-control" value={txForm.payment_method} onChange={(e) => setTxForm((p) => ({ ...p, payment_method: e.target.value }))}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setTxModal(null)}>Cancelar</button>
              <button type="submit" className={`btn ${txModal === 'entry' ? 'btn-success' : 'btn-warning'}`} disabled={saving}>
                {saving ? 'Salvando...' : txModal === 'entry' ? 'Registrar Entrada' : 'Registrar Saída'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Close confirm */}
      {closingConfirm && (
        <Modal title="Fechar Caixa" onClose={() => setClosingConfirm(false)}>
          <p style={{ marginBottom: 12 }}>Confirma o fechamento do caixa?</p>
          {summary && (
            <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: '.85rem' }}>
              <p>Saldo Inicial: <strong>{fmtCurrency(myOpen?.opening_balance ?? 0)}</strong></p>
              <p>Entradas: <strong style={{ color: '#16a34a' }}>{fmtCurrency(summary.totals.entries)}</strong></p>
              <p>Saídas: <strong style={{ color: '#dc2626' }}>{fmtCurrency(summary.totals.exits)}</strong></p>
              <p>Saldo Final: <strong>{fmtCurrency(summary.current_balance)}</strong></p>
            </div>
          )}
          <div className="form-group">
            <label>Observações</label>
            <textarea className="form-control" rows={2} value={closeObs} onChange={(e) => setCloseObs(e.target.value)} />
          </div>
          <div className="confirm-actions">
            <button className="btn btn-outline" onClick={() => setClosingConfirm(false)}>Voltar</button>
            <button className="btn btn-danger" onClick={handleClose} disabled={saving}>{saving ? 'Fechando...' : 'Fechar Caixa'}</button>
          </div>
        </Modal>
      )}

      {/* Cancel TX */}
      {cancelTx && (
        <Modal title="Cancelar Transação" onClose={() => setCancelTx(null)}>
          <p style={{ marginBottom: 12 }}>Cancelar transação: <strong>{cancelTx.description}</strong> ({fmtCurrency(cancelTx.amount)})?</p>
          <div className="form-group">
            <label>Motivo do cancelamento *</label>
            <input className="form-control" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus />
          </div>
          <div className="confirm-actions">
            <button className="btn btn-outline" onClick={() => setCancelTx(null)}>Voltar</button>
            <button className="btn btn-danger" onClick={handleCancelTx}>Cancelar Transação</button>
          </div>
        </Modal>
      )}

      {/* View Summary */}
      {viewSummary && (
        <Modal title={`Resumo Caixa #${viewSummary.register.id}`} onClose={() => setViewSummary(null)} large>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, fontSize: '.85rem' }}>
              <p><strong>Saldo Inicial:</strong> {fmtCurrency(viewSummary.register.opening_balance)}</p>
              <p><strong>Entradas:</strong> <span style={{ color: '#16a34a' }}>{fmtCurrency(viewSummary.totals.entries)}</span></p>
              <p><strong>Saídas:</strong> <span style={{ color: '#dc2626' }}>{fmtCurrency(viewSummary.totals.exits)}</span></p>
              <p><strong>Saldo Atual:</strong> {fmtCurrency(viewSummary.current_balance)}</p>
            </div>
            <div>
              <h4 style={{ fontSize: '.85rem', marginBottom: 8 }}>Por Categoria</h4>
              {viewSummary.by_category.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', padding: '2px 0' }}>
                  <span>{TX_CATEGORY_LABELS[c.category] ?? c.category} ({c.type === 'entry' ? 'E' : 'S'})</span>
                  <span>{fmtCurrency(c.total)} ({c.count}x)</span>
                </div>
              ))}
            </div>
          </div>
          <h4 style={{ fontSize: '.85rem', marginBottom: 8 }}>Por Forma de Pagamento</h4>
          {viewSummary.by_payment_method.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', padding: '2px 0' }}>
              <span>{PAYMENT_METHOD_LABELS[m.payment_method] ?? m.payment_method}</span>
              <span>{fmtCurrency(m.total)} ({m.count}x)</span>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
