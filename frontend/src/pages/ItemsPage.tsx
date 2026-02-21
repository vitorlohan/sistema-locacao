import { useEffect, useState, useCallback, type FormEvent } from 'react';
import api from '../services/api';
import type { Item, ItemPricing } from '../types';
import { fmtCurrency, ITEM_STATUS_LABELS, statusBadgeClass } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';

interface PricingTier { duration_minutes: number; label: string; price: number; tolerance_minutes: number; }
interface ItemForm { name: string; internal_code: string; category: string; status: string; observations: string; }

const EMPTY_FORM: ItemForm = { name: '', internal_code: '', category: '', status: 'available', observations: '' };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tiers, setTiers] = useState<PricingTier[]>([{ duration_minutes: 30, label: '30 min', price: 0, tolerance_minutes: 0 }]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, cats] = await Promise.all([
        api.get('/items', { params: { search, category: filterCat || undefined, status: filterStatus || undefined } }),
        api.get('/items/categories'),
      ]);
      setItems(Array.isArray(res.data) ? res.data : []);
      setCategories(Array.isArray(cats.data) ? cats.data : []);
    } finally { setLoading(false); }
  }, [search, filterCat, filterStatus]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTiers([{ duration_minutes: 30, label: '30 min', price: 0, tolerance_minutes: 0 }]);
    setModal(true);
  }

  async function openEdit(item: Item) {
    setEditing(item);
    setForm({
      name: item.name,
      internal_code: item.internal_code,
      category: item.category,
      status: item.status as string,
      observations: item.observations ?? '',
    });
    try {
      const { data } = await api.get(`/items/${item.id}/pricing`);
      const loaded = Array.isArray(data)
        ? data.map((t: ItemPricing) => ({ duration_minutes: t.duration_minutes, label: t.label, price: t.price, tolerance_minutes: t.tolerance_minutes || 0 }))
        : [];
      setTiers(loaded.length > 0 ? loaded : [{ duration_minutes: 60, label: '1 hora', price: item.rental_value, tolerance_minutes: 0 }]);
    } catch {
      setTiers([{ duration_minutes: 60, label: '1 hora', price: item.rental_value, tolerance_minutes: 0 }]);
    }
    setModal(true);
  }

  function addTier() {
    setTiers((p) => [...p, { duration_minutes: 30, label: '', price: 0, tolerance_minutes: 0 }]);
  }

  function removeTier(idx: number) {
    if (tiers.length <= 1) { toast.error('É necessário pelo menos uma faixa de preço'); return; }
    setTiers((p) => p.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, field: keyof PricingTier, val: any) {
    setTiers((p) => p.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name || form.name.length < 2) { toast.error('Nome é obrigatório (min 2)'); return; }
    if (!form.internal_code) { toast.error('Código interno é obrigatório'); return; }
    if (!form.category) { toast.error('Categoria é obrigatória'); return; }

    for (const tier of tiers) {
      if (!tier.label.trim()) { toast.error('Preencha o nome de todas as faixas'); return; }
      if (tier.duration_minutes <= 0) { toast.error('Duração deve ser maior que zero'); return; }
      if (tier.price <= 0) { toast.error('Preço deve ser maior que zero'); return; }
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/items/${editing.id}`, { ...form, rental_value: tiers[0]?.price || 0 });
        await api.put(`/items/${editing.id}/pricing`, { tiers });
        toast.success('Item atualizado');
      } else {
        await api.post('/items', {
          ...form,
          rental_value: tiers[0]?.price || 0,
          rental_period: 'hour',
          pricing_tiers: tiers,
        });
        toast.success('Item cadastrado');
      }
      setModal(false);
      load();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.delete(`/items/${deleting.id}`);
      toast.success('Item removido');
      setDeleting(null);
      load();
    } catch { /* */ }
  }

  const set = (field: string, val: any) => setForm((p) => ({ ...p, [field]: val }));

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>Itens</h3>
          <button className="btn btn-primary" onClick={openNew}><FiPlus /> Novo Item</button>
        </div>

        <div className="toolbar">
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 9, color: '#9ca3af' }} />
            <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-control" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Todas categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos status</option>
            <option value="available">Disponível</option>
            <option value="rented">Alugado</option>
            <option value="maintenance">Manutenção</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state"><p>Nenhum item encontrado</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Código</th><th>Nome</th><th>Categoria</th><th>A partir de</th><th>Status</th><th style={{ width: 100 }}>Ações</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td><code>{i.internal_code}</code></td>
                    <td><strong>{i.name}</strong></td>
                    <td>{i.category}</td>
                    <td>{fmtCurrency(i.rental_value)}</td>
                    <td><span className={`badge ${statusBadgeClass(i.status)}`}>{ITEM_STATUS_LABELS[i.status]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(i)} title="Editar"><FiEdit2 /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleting(i)} title="Excluir"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <Modal title={editing ? 'Editar Item' : 'Novo Item'} onClose={() => setModal(false)} large>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Nome *</label>
                <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label>Código Interno *</label>
                <input className="form-control" value={form.internal_code} onChange={(e) => set('internal_code', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Categoria *</label>
                <input className="form-control" value={form.category} onChange={(e) => set('category', e.target.value)} list="cats" />
                <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              {editing && (
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="available">Disponível</option>
                    <option value="rented">Alugado</option>
                    <option value="maintenance">Manutenção</option>
                  </select>
                </div>
              )}
            </div>

            {/* Pricing Tiers */}
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 600, fontSize: '.9rem' }}>Faixas de Preço *</label>
                <button type="button" className="btn btn-sm btn-outline" onClick={addTier}><FiPlus /> Adicionar</button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Nome da Faixa</th>
                      <th style={{ width: 130 }}>Duração (min)</th>
                      <th style={{ width: 130 }}>Preço (R$)</th>
                      <th style={{ width: 120 }}>Tolerância (min)</th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, idx) => (
                      <tr key={idx}>
                        <td>
                          <input className="form-control" value={tier.label} onChange={(e) => updateTier(idx, 'label', e.target.value)} placeholder="Ex: 30 minutos" />
                        </td>
                        <td>
                          <input className="form-control" type="number" min={1} value={tier.duration_minutes} onChange={(e) => updateTier(idx, 'duration_minutes', Number(e.target.value))} />
                        </td>
                        <td>
                          <input className="form-control" type="number" min={0} step={0.01} value={tier.price} onChange={(e) => updateTier(idx, 'price', Number(e.target.value))} />
                        </td>
                        <td>
                          <input className="form-control" type="number" min={0} value={tier.tolerance_minutes} onChange={(e) => updateTier(idx, 'tolerance_minutes', Number(e.target.value))} title="Tempo extra tolerado sem cobrar" />
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeTier(idx)} title="Remover"><FiTrash2 /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-group">
              <label>Observações</label>
              <textarea className="form-control" rows={2} value={form.observations} onChange={(e) => set('observations', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Excluir Item" message={`Excluir "${deleting.name}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} confirmLabel="Excluir" danger />
      )}
    </>
  );
}
