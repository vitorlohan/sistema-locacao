import { useEffect, useState, useCallback, type FormEvent } from 'react';
import api from '../services/api';
import type { Client } from '../types';
import { fmtDate } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';

const EMPTY: Partial<Client> = { name: '', document: '', phone: '', email: '', address: '', observations: '', child_name: '', birth_date: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients', { params: { search } });
      setClients(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true); }
  function openEdit(c: Client) { setEditing(c); setForm({ ...c }); setModal(true); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name || form.name.length < 2) { toast.error('Nome é obrigatório (min 2 caracteres)'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/clients/${editing.id}`, form);
        toast.success('Cliente atualizado');
      } else {
        await api.post('/clients', form);
        toast.success('Cliente cadastrado');
      }
      setModal(false);
      load();
    } catch { /* api interceptor handles */ }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.delete(`/clients/${deleting.id}`);
      toast.success('Cliente removido');
      setDeleting(null);
      load();
    } catch { /* */ }
  }

  const set = (field: string, val: string) => setForm((p) => ({ ...p, [field]: val }));

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>Clientes</h3>
          <button className="btn btn-primary" onClick={openNew}><FiPlus /> Novo Cliente</button>
        </div>

        <div className="toolbar">
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: 9, color: '#9ca3af' }} />
            <input
              className="form-control"
              style={{ paddingLeft: 32 }}
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : clients.length === 0 ? (
          <div className="empty-state"><p>Nenhum cliente encontrado</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Criança</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th>Cadastro</th><th style={{ width: 100 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.child_name || '-'}</td>
                    <td>{c.document || '-'}</td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td>{fmtDate(c.created_at)}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)} title="Editar"><FiEdit2 /></button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleting(c)} title="Excluir"><FiTrash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal title={editing ? 'Editar Cliente' : 'Novo Cliente'} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome *</label>
              <input className="form-control" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Nome da Criança <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                <input className="form-control" value={form.child_name ?? ''} onChange={(e) => set('child_name', e.target.value)} placeholder="Preencha apenas se aplicável" />
              </div>
              <div className="form-group">
                <label>Data de Nasc. da Criança <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                <input className="form-control" type="date" value={form.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Documento (CPF/CNPJ)</label>
                <input className="form-control" value={form.document ?? ''} onChange={(e) => set('document', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input className="form-control" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input className="form-control" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Endereço</label>
              <input className="form-control" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Observações</label>
              <textarea className="form-control" rows={3} value={form.observations ?? ''} onChange={(e) => set('observations', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm delete */}
      {deleting && (
        <ConfirmDialog
          title="Excluir Cliente"
          message={`Tem certeza que deseja excluir "${deleting.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          confirmLabel="Excluir"
          danger
        />
      )}
    </>
  );
}
