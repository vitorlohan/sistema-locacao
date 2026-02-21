import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react';
import api from '../services/api';
import type { Rental, Client, Item, PaymentBalance, ItemPricing } from '../types';
import { fmtCurrency, fmtDateTime, RENTAL_STATUS_LABELS, RENTAL_PERIOD_LABELS, PAYMENT_METHOD_LABELS, statusBadgeClass, generateReceipt } from '../utils/helpers';
import { generatePixQRCode, copyPixPayload, type PixConfig } from '../utils/pix';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { FiPlus, FiCheck, FiXCircle, FiDollarSign, FiRefreshCw, FiFileText, FiSend, FiClock, FiCopy } from 'react-icons/fi';

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  /* CRU aux data */
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  /* New rental modal */
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ client_id: '', item_id: '', start_date: '', expected_end_date: '', deposit: 0, discount: 0, observations: '', pricing_id: '' });
  const [saving, setSaving] = useState(false);
  const [itemPricingTiers, setItemPricingTiers] = useState<ItemPricing[]>([]);

  /* Payment modal */
  const [payModal, setPayModal] = useState<Rental | null>(null);
  const [payBalance, setPayBalance] = useState<PaymentBalance | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_method: 'pix', notes: '' });

  /* Confirm actions */
  const [completing, setCompleting] = useState<Rental | null>(null);
  const [cancelling, setCancelling] = useState<Rental | null>(null);
  const [forceComplete, setForceComplete] = useState<Rental | null>(null);
  const [completeAfterPay, setCompleteAfterPay] = useState(false);

  /* Cashier modal */
  const [cashierModal, setCashierModal] = useState<Rental | null>(null);
  const [cashierType, setCashierType] = useState<'full' | 'deposit' | 'payment'>('full');
  const [cashierAmount, setCashierAmount] = useState(0);
  const [sendingCashier, setSendingCashier] = useState(false);

  /* Late fee preview */
  const [lateFeePreview, setLateFeePreview] = useState(0);
  const [includeLateFee, setIncludeLateFee] = useState(true);

  /* PIX QR Code */
  const [pixQR, setPixQR] = useState<string>('');
  const [pixConfig, setPixConfig] = useState<PixConfig | null>(null);

  /* Elapsed time ticker */
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30000); // update every 30s
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  function elapsedTime(startDate: string): string {
    const start = new Date(startDate.replace(' ', 'T'));
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    if (diffMs < 0) return '00:00';
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function calcLateFee(rental: Rental): number {
    if (rental.status !== 'overdue' && rental.status !== 'active') return 0;
    const now = new Date();
    const expectedEnd = new Date(rental.expected_end_date.replace(' ', 'T'));
    if (now <= expectedEnd) return 0;
    const minutesLate = Math.floor((now.getTime() - expectedEnd.getTime()) / 60000);
    if (minutesLate <= 0) return 0;
    const durationMinutes = rental.pricing_duration_minutes || 60;
    const perMinuteRate = rental.rental_value / durationMinutes;
    return Math.round(perMinuteRate * minutesLate * 100) / 100;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/rentals', { params: { status: filterStatus || undefined } });
      setRentals(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  /* Load PIX config once */
  useEffect(() => {
    api.get('/settings', { params: { prefix: 'pix.' } }).then(({ data }) => {
      if (data?.['pix.key'] && data?.['pix.merchant_name']) {
        setPixConfig({
          pixKey: data['pix.key'],
          pixKeyType: data['pix.key_type'] || 'cpf',
          merchantName: data['pix.merchant_name'],
          merchantCity: data['pix.merchant_city'] || 'SaoPaulo',
        });
      }
    }).catch(() => { /* no pix config yet */ });
  }, []);

  /* Generate PIX QR when payment method is pix and we have config */
  useEffect(() => {
    if (payForm.payment_method === 'pix' && pixConfig && payForm.amount > 0 && payModal) {
      generatePixQRCode(pixConfig, payForm.amount, `LOC${payModal.id}`)
        .then(setPixQR)
        .catch(() => setPixQR(''));
    } else {
      setPixQR('');
    }
  }, [payForm.payment_method, payForm.amount, pixConfig, payModal]);

  async function openNew() {
    const [c, i] = await Promise.all([api.get('/clients'), api.get('/items', { params: { status: 'available' } })]);
    setClients(Array.isArray(c.data) ? c.data : []);
    setItems(Array.isArray(i.data) ? i.data : []);
    // Auto-fill start date with current local time
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setNewForm({ client_id: '', item_id: '', start_date: nowStr, expected_end_date: '', deposit: 0, discount: 0, observations: '', pricing_id: '' });
    setItemPricingTiers([]);
    setNewModal(true);
  }

  async function handleItemChange(itemId: string) {
    setNewForm((p) => ({ ...p, item_id: itemId, pricing_id: '' }));
    if (!itemId) { setItemPricingTiers([]); return; }
    try {
      const { data } = await api.get(`/items/${itemId}/pricing`);
      setItemPricingTiers(Array.isArray(data) ? data : []);
    } catch { setItemPricingTiers([]); }
  }

  function handlePricingSelect(pricingId: string) {
    const tier = itemPricingTiers.find((t) => String(t.id) === pricingId);
    if (tier && newForm.start_date) {
      const start = new Date(newForm.start_date);
      const end = new Date(start.getTime() + tier.duration_minutes * 60000);
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      setNewForm((p) => ({ ...p, pricing_id: pricingId, expected_end_date: endStr }));
    } else {
      setNewForm((p) => ({ ...p, pricing_id: pricingId }));
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newForm.client_id || !newForm.item_id || !newForm.start_date || !newForm.expected_end_date) {
      toast.error('Preencha todos os campos obrigatórios'); return;
    }
    setSaving(true);
    try {
      await api.post('/rentals', {
        client_id: Number(newForm.client_id),
        item_id: Number(newForm.item_id),
        start_date: newForm.start_date,
        expected_end_date: newForm.expected_end_date,
        deposit: newForm.deposit,
        discount: newForm.discount,
        observations: newForm.observations || undefined,
        pricing_id: newForm.pricing_id ? Number(newForm.pricing_id) : undefined,
      });
      toast.success('Aluguel criado');
      setNewModal(false);
      load();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function tryComplete(r: Rental) {
    // Fetch current balance to check debt
    try {
      const { data } = await api.get(`/payments/balance/${r.id}`);
      const fee = calcLateFee(r);
      const remainingWithFee = data.remaining + fee;
      if (remainingWithFee > 0) {
        // Has debt — open payment modal with finalize context
        setLateFeePreview(fee);
        setIncludeLateFee(fee > 0);
        setPayBalance(data);
        setPayForm({ amount: fee > 0 ? data.remaining + fee : data.remaining, payment_method: 'pix', notes: '' });
        setPayModal(r);
        setCompleteAfterPay(true);
        return;
      }
    } catch { /* continue to normal finalize */ }
    // Fully paid — normal confirm
    setCompleting(r);
  }

  async function handleComplete() {
    if (!completing) return;
    try {
      await api.post(`/rentals/${completing.id}/complete`);
      toast.success('Aluguel finalizado');
      setCompleting(null);
      load();
    } catch { /* */ }
  }

  async function handleForceComplete() {
    if (!forceComplete) return;
    try {
      await api.post(`/rentals/${forceComplete.id}/complete`);
      toast.success('Aluguel finalizado (forçado)');
      setForceComplete(null);
      load();
    } catch { /* */ }
  }

  async function handleCancel() {
    if (!cancelling) return;
    try {
      await api.post(`/rentals/${cancelling.id}/cancel`);
      toast.success('Aluguel cancelado');
      setCancelling(null);
      load();
    } catch { /* */ }
  }

  async function openPay(r: Rental) {
    try {
      const { data } = await api.get(`/payments/balance/${r.id}`);
      const fee = calcLateFee(r);
      setLateFeePreview(fee);
      setIncludeLateFee(fee > 0);
      setPayBalance(data);
      setPayForm({ amount: fee > 0 ? data.remaining + fee : data.remaining, payment_method: 'pix', notes: '' });
      setPayModal(r);
    } catch { /* toast shown by interceptor */ }
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!payModal || payForm.amount <= 0) { toast.error('Valor inválido'); return; }
    setSaving(true);
    try {
      await api.post('/payments', { rental_id: payModal.id, amount: payForm.amount, payment_method: payForm.payment_method, notes: payForm.notes || undefined });
      toast.success('Pagamento registrado');
      // Check if fully paid now
      const { data: bal } = await api.get(`/payments/balance/${payModal.id}`);
      if (completeAfterPay && bal.remaining <= 0) {
        // Fully paid — proceed to finalize
        setPayModal(null);
        setCompleting(payModal);
        setCompleteAfterPay(false);
      } else if (completeAfterPay && bal.remaining > 0) {
        // Still has debt — update balance, stay in modal
        setPayBalance(bal);
        setPayForm({ amount: bal.remaining, payment_method: 'pix', notes: '' });
      } else {
        setPayModal(null);
      }
      load();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  function openCashier(r: Rental) {
    setCashierModal(r);
    setCashierType('full');
    setCashierAmount(r.total_paid);
  }

  async function handleSendToCashier() {
    if (!cashierModal) return;
    setSendingCashier(true);
    try {
      await api.post(`/rentals/${cashierModal.id}/send-to-cashier`, {
        type: cashierType,
        amount: cashierType === 'payment' ? cashierAmount : undefined,
      });
      toast.success('Enviado ao caixa com sucesso');
      setCashierModal(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || '';
      if (err?.response?.status === 409) {
        toast.error(msg || 'Valor já enviado ao caixa ou nenhum caixa aberto.');
      }
    } finally { setSendingCashier(false); }
  }

  async function checkOverdue() {
    try {
      const { data } = await api.post('/rentals/check-overdue');
      toast.success(data.message || 'Verificação concluída');
      load();
    } catch { /* toast shown by interceptor */ }
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>Aluguéis</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={checkOverdue} title="Verificar atrasos"><FiRefreshCw /> Verificar Atrasos</button>
            <button className="btn btn-primary" onClick={openNew}><FiPlus /> Novo Aluguel</button>
          </div>
        </div>

        <div className="toolbar">
          <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="overdue">Atrasados</option>
            <option value="completed">Concluídos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : rentals.length === 0 ? (
          <div className="empty-state"><p>Nenhum aluguel encontrado</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Cliente</th><th>Criança</th><th>Item</th><th>Início</th><th>Prev.Entrega</th><th>Tempo / Entrega</th>
                  <th>Valor</th><th>Pago</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r.id} style={(r.status === 'overdue') ? { background: '#fef2f2' } : undefined}>
                    <td>{r.id}</td>
                    <td>{r.client_name}</td>
                    <td>{r.child_name || '-'}</td>
                    <td>{r.item_name} <small style={{ color: '#9ca3af' }}>({r.item_code})</small></td>
                    <td>{fmtDateTime(r.start_date)}</td>
                    <td style={{ fontSize: '.85rem', color: '#6b7280' }}>{fmtDateTime(r.expected_end_date)}</td>
                    <td>
                      {(r.status === 'active' || r.status === 'overdue') ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: r.status === 'overdue' ? '#dc2626' : '#2563eb', fontFamily: 'monospace' }}>
                          <FiClock size={13} /> {elapsedTime(r.start_date)}
                        </span>
                      ) : r.actual_end_date ? (
                        <span style={{ color: '#16a34a', fontSize: '.85rem' }}>{fmtDateTime(r.actual_end_date)}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '.85rem' }}>-</span>
                      )}
                    </td>
                    <td>{fmtCurrency(r.total_value)}</td>
                    <td>
                      <span style={{ color: r.total_paid >= r.total_value ? '#16a34a' : r.total_paid > 0 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                        {fmtCurrency(r.total_paid)}
                      </span>
                    </td>
                    <td><span className={`badge ${statusBadgeClass(r.status)}`}>{RENTAL_STATUS_LABELS[r.status]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(r.status === 'active' || r.status === 'overdue') && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => tryComplete(r)} title="Finalizar"><FiCheck /></button>
                            <button className="btn btn-sm btn-warning" onClick={() => openPay(r)} title="Pagamento"><FiDollarSign /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => setCancelling(r)} title="Cancelar"><FiXCircle /></button>
                          </>
                        )}
                        <button className="btn btn-sm btn-outline" onClick={() => openCashier(r)} title="Enviar ao Caixa"><FiSend /></button>
                        <button className="btn btn-sm btn-outline" onClick={() => generateReceipt(r)} title="Gerar Recibo / NF"><FiFileText /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Rental Modal */}
      {newModal && (
        <Modal title="Novo Aluguel" onClose={() => setNewModal(false)} large>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Cliente *</label>
                <select className="form-control" value={newForm.client_id} onChange={(e) => setNewForm((p) => ({ ...p, client_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.child_name ? ` (${c.child_name})` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Item *</label>
                <select className="form-control" value={newForm.item_id} onChange={(e) => handleItemChange(e.target.value)}>
                  <option value="">Selecione...</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.internal_code}) - {fmtCurrency(i.rental_value)}/{RENTAL_PERIOD_LABELS[i.rental_period] ?? i.rental_period}</option>)}
                </select>
              </div>
            </div>

            {/* Pricing tiers selector */}
            {itemPricingTiers.length > 0 && (
              <div className="form-group">
                <label>Faixa de Preço</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', background: !newForm.pricing_id ? '#eff6ff' : '#fff', borderColor: !newForm.pricing_id ? '#2563eb' : '#d1d5db' }}>
                    <input type="radio" name="pricing" value="" checked={!newForm.pricing_id} onChange={() => setNewForm((p) => ({ ...p, pricing_id: '' }))} />
                    <span>Manual</span>
                  </label>
                  {itemPricingTiers.map((tier) => (
                    <label key={tier.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', background: newForm.pricing_id === String(tier.id) ? '#eff6ff' : '#fff', borderColor: newForm.pricing_id === String(tier.id) ? '#2563eb' : '#d1d5db' }}>
                      <input type="radio" name="pricing" value={tier.id} checked={newForm.pricing_id === String(tier.id)} onChange={() => handlePricingSelect(String(tier.id))} />
                      <span><strong>{tier.label}</strong> — {fmtCurrency(tier.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Data Início *</label>
                <input className="form-control" type="datetime-local" value={newForm.start_date} onChange={(e) => {
                  setNewForm((p) => ({ ...p, start_date: e.target.value }));
                  // Recalculate end date if pricing tier is selected
                  if (newForm.pricing_id) {
                    const tier = itemPricingTiers.find((t) => String(t.id) === newForm.pricing_id);
                    if (tier && e.target.value) {
                      const start = new Date(e.target.value);
                      const end = new Date(start.getTime() + tier.duration_minutes * 60000);
                      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                      setNewForm((p) => ({ ...p, start_date: e.target.value, expected_end_date: endStr }));
                    }
                  }
                }} />
              </div>
              <div className="form-group">
                <label>Prev. Devolução *</label>
                <input className="form-control" type="datetime-local" value={newForm.expected_end_date} onChange={(e) => setNewForm((p) => ({ ...p, expected_end_date: e.target.value }))} readOnly={!!newForm.pricing_id} style={newForm.pricing_id ? { background: '#f3f4f6' } : undefined} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Caução (R$)</label>
                <input className="form-control" type="number" min={0} step={0.01} value={newForm.deposit} onChange={(e) => setNewForm((p) => ({ ...p, deposit: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Desconto (R$)</label>
                <input className="form-control" type="number" min={0} step={0.01} value={newForm.discount} onChange={(e) => setNewForm((p) => ({ ...p, discount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Observações</label>
              <textarea className="form-control" rows={2} value={newForm.observations} onChange={(e) => setNewForm((p) => ({ ...p, observations: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setNewModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Criando...' : 'Criar Aluguel'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment Modal */}
      {payModal && payBalance && (
        <Modal title={completeAfterPay ? `Débito Pendente - ${payModal.item_name}` : `Pagamento - ${payModal.item_name}`} onClose={() => { setPayModal(null); setCompleteAfterPay(false); setLateFeePreview(0); }}>
          {completeAfterPay && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '.85rem', color: '#92400e' }}>
              <strong>⚠️ Aluguel com débito em aberto.</strong> Registre o pagamento para finalizar, ou force a finalização.
            </div>
          )}
          <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '.85rem' }}>
            <p>Total: <strong>{fmtCurrency(payBalance.total_value)}</strong></p>
            <p>Pago: <strong>{fmtCurrency(payBalance.total_paid)}</strong></p>
            <p>Restante: <strong style={{ color: payBalance.remaining > 0 ? '#dc2626' : '#16a34a' }}>{fmtCurrency(payBalance.remaining)}</strong></p>
          </div>
          {/* Late fee preview */}
          {lateFeePreview > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#991b1b', fontWeight: 600 }}>⏱️ Taxa de Atraso</span>
                <strong style={{ color: '#dc2626' }}>+ {fmtCurrency(lateFeePreview)}</strong>
              </div>
              <p style={{ color: '#7f1d1d', fontSize: '.8rem', margin: '0 0 8px 0' }}>
                {(() => {
                  const expectedEnd = new Date(payModal.expected_end_date.replace(' ', 'T'));
                  const minutesLate = Math.floor((Date.now() - expectedEnd.getTime()) / 60000);
                  const durationMinutes = payModal.pricing_duration_minutes || 60;
                  const perMinuteRate = payModal.rental_value / durationMinutes;
                  return `${minutesLate} min atrasado × ${fmtCurrency(perMinuteRate)}/min`;
                })()}
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeLateFee}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludeLateFee(checked);
                    setPayForm((p) => ({
                      ...p,
                      amount: checked ? payBalance.remaining + lateFeePreview : payBalance.remaining,
                    }));
                  }}
                />
                <span style={{ color: '#991b1b', fontWeight: 500 }}>Incluir taxa de atraso no pagamento</span>
              </label>
              {includeLateFee && (
                <p style={{ color: '#991b1b', fontWeight: 600, marginTop: 6, fontSize: '.85rem' }}>
                  Total a pagar: {fmtCurrency(payBalance.remaining)} + {fmtCurrency(lateFeePreview)} = <strong>{fmtCurrency(payBalance.remaining + lateFeePreview)}</strong>
                </p>
              )}
            </div>
          )}
          {payBalance.remaining <= 0 && lateFeePreview <= 0 ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: 12 }}>Totalmente pago!</p>
              {completeAfterPay && (
                <button className="btn btn-success" onClick={() => { setPayModal(null); setCompleting(payModal); setCompleteAfterPay(false); }}>Finalizar Aluguel</button>
              )}
            </div>
          ) : (
            <form onSubmit={handlePay}>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor *</label>
                  <input className="form-control" type="number" min={0.01} step={0.01} value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label>Forma de Pagamento</label>
                  <select className="form-control" value={payForm.payment_method} onChange={(e) => setPayForm((p) => ({ ...p, payment_method: e.target.value }))}>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              {/* PIX QR Code */}
              {payForm.payment_method === 'pix' && pixQR && (
                <div style={{ textAlign: 'center', padding: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 12 }}>
                  <p style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 8, color: '#15803d' }}>PIX QR Code</p>
                  <img src={pixQR} alt="PIX QR Code" style={{ width: 220, height: 220, margin: '0 auto' }} />
                  <p style={{ fontSize: '.75rem', color: '#6b7280', marginTop: 8 }}>Escaneie o QR Code com o app do seu banco</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      if (pixConfig && payModal) {
                        copyPixPayload(pixConfig, payForm.amount, `LOC${payModal.id}`);
                        toast.success('Código PIX copiado!');
                      }
                    }}
                  >
                    <FiCopy /> Copiar Pix Copia e Cola
                  </button>
                </div>
              )}
              {payForm.payment_method === 'pix' && !pixConfig && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '.8rem', color: '#92400e' }}>
                  Configure a chave PIX nas Configurações para gerar QR Codes automaticamente.
                </div>
              )}
              <div className="form-group">
                <label>Observações</label>
                <input className="form-control" value={payForm.notes} onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => { setPayModal(null); setCompleteAfterPay(false); setLateFeePreview(0); }}>Cancelar</button>
                {completeAfterPay && (
                  <button type="button" className="btn btn-warning" onClick={() => { setPayModal(null); setCompleteAfterPay(false); setLateFeePreview(0); setForceComplete(payModal); }}>Forçar Finalização</button>
                )}
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Salvando...' : 'Registrar Pagamento'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Cashier Modal */}
      {cashierModal && (
        <Modal title={`Enviar ao Caixa - #${cashierModal.id}`} onClose={() => setCashierModal(null)}>
          <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '.85rem' }}>
            <p>Item: <strong>{cashierModal.item_name}</strong></p>
            <p>Valor Total: <strong>{fmtCurrency(cashierModal.total_value)}</strong></p>
            <p>Já Pago: <strong>{fmtCurrency(cashierModal.total_paid)}</strong></p>
            {cashierModal.deposit > 0 && <p>Caução: <strong>{fmtCurrency(cashierModal.deposit)}</strong></p>}
            {cashierModal.discount > 0 && <p>Desconto: <strong>{fmtCurrency(cashierModal.discount)}</strong></p>}
          </div>
          <div className="form-group">
            <label>Tipo de Lançamento</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: cashierType === 'full' ? '#eff6ff' : '#fff', borderColor: cashierType === 'full' ? '#2563eb' : '#d1d5db' }}>
                <input type="radio" name="cashierType" checked={cashierType === 'full'} onChange={() => setCashierType('full')} />
                <div><strong>Completo</strong><br /><small style={{ color: '#6b7280' }}>Registra total pago como entrada{cashierModal.discount > 0 ? ' e desconto como saída' : ''}</small></div>
              </label>
              {cashierModal.deposit > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: cashierType === 'deposit' ? '#eff6ff' : '#fff', borderColor: cashierType === 'deposit' ? '#2563eb' : '#d1d5db' }}>
                  <input type="radio" name="cashierType" checked={cashierType === 'deposit'} onChange={() => setCashierType('deposit')} />
                  <div><strong>Somente Caução</strong><br /><small style={{ color: '#6b7280' }}>Registra apenas o valor da caução ({fmtCurrency(cashierModal.deposit)})</small></div>
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: cashierType === 'payment' ? '#eff6ff' : '#fff', borderColor: cashierType === 'payment' ? '#2563eb' : '#d1d5db' }}>
                <input type="radio" name="cashierType" checked={cashierType === 'payment'} onChange={() => setCashierType('payment')} />
                <div><strong>Valor Personalizado</strong><br /><small style={{ color: '#6b7280' }}>Informe o valor a registrar no caixa</small></div>
              </label>
            </div>
          </div>
          {cashierType === 'payment' && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Valor (R$)</label>
              <input className="form-control" type="number" min={0.01} step={0.01} value={cashierAmount} onChange={(e) => setCashierAmount(Number(e.target.value))} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setCashierModal(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={handleSendToCashier} disabled={sendingCashier}>{sendingCashier ? 'Enviando...' : 'Enviar ao Caixa'}</button>
          </div>
        </Modal>
      )}

      {completing && <ConfirmDialog title="Finalizar Aluguel" message={`Finalizar aluguel #${completing.id} (${completing.item_name})?`} onConfirm={handleComplete} onCancel={() => setCompleting(null)} confirmLabel="Finalizar" />}
      {forceComplete && <ConfirmDialog title="Finalizar em Débito" message={`⚠️ Este aluguel possui débito em aberto (Restante: ${fmtCurrency(forceComplete.total_value - forceComplete.total_paid)}).\n\nDeseja forçar a finalização mesmo em débito?`} onConfirm={handleForceComplete} onCancel={() => setForceComplete(null)} confirmLabel="Forçar Finalização" danger />}
      {cancelling && <ConfirmDialog title="Cancelar Aluguel" message={`Cancelar aluguel #${cancelling.id}? Esta ação não pode ser desfeita.`} onConfirm={handleCancel} onCancel={() => setCancelling(null)} confirmLabel="Cancelar Aluguel" danger />}
    </>
  );
}
