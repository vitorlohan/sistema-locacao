import { useEffect, useState, type FormEvent } from 'react';
import api from '../services/api';
import { generatePixQRCode, type PixConfig } from '../utils/pix';
import toast from 'react-hot-toast';
import { FiSave, FiSmartphone } from 'react-icons/fi';

type Tab = 'pix' | 'empresa' | 'ticket';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('pix');

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'pix' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('pix')}>
          <FiSmartphone /> PIX / Pagamento
        </button>
        <button className={`btn ${tab === 'empresa' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('empresa')}>
          Dados da Empresa
        </button>
        <button className={`btn ${tab === 'ticket' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('ticket')}>
          Ticket / Recibo
        </button>
      </div>

      {tab === 'pix' && <PixSettings />}
      {tab === 'empresa' && <EmpresaSettings />}
      {tab === 'ticket' && <TicketSettings />}
    </>
  );
}

/* ───── PIX Settings ───── */
function PixSettings() {
  const [form, setForm] = useState({
    'pix.key': '',
    'pix.key_type': 'cpf',
    'pix.merchant_name': '',
    'pix.merchant_city': '',
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    api.get('/settings', { params: { prefix: 'pix.' } }).then(({ data }) => {
      if (data && typeof data === 'object') {
        setForm((prev) => ({ ...prev, ...data }));
      }
    }).catch(() => { });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form['pix.key']) { toast.error('Chave PIX é obrigatória'); return; }
    if (!form['pix.merchant_name']) { toast.error('Nome do recebedor é obrigatório'); return; }
    setSaving(true);
    try {
      await api.put('/settings/batch', form);
      toast.success('Configurações PIX salvas!');
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function generatePreview() {
    if (!form['pix.key'] || !form['pix.merchant_name']) {
      toast.error('Preencha a chave e nome primeiro');
      return;
    }
    const config: PixConfig = {
      pixKey: form['pix.key'],
      pixKeyType: form['pix.key_type'],
      merchantName: form['pix.merchant_name'],
      merchantCity: form['pix.merchant_city'] || 'SaoPaulo',
    };
    try {
      const qr = await generatePixQRCode(config, 1.00, 'TESTE');
      setPreview(qr);
    } catch { toast.error('Erro ao gerar QR Code de teste'); }
  }

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="card">
      <div className="card-header">
        <h3>Configurações PIX</h3>
      </div>
      <form onSubmit={handleSave} style={{ padding: 20 }}>
        <p style={{ fontSize: '.85rem', color: '#6b7280', marginBottom: 16 }}>
          Configure sua chave PIX para gerar QR Codes de pagamento automaticamente nos aluguéis.
        </p>

        <div className="form-row">
          <div className="form-group">
            <label>Tipo de Chave</label>
            <select className="form-control" value={form['pix.key_type']} onChange={(e) => set('pix.key_type', e.target.value)}>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave Aleatória</option>
            </select>
          </div>
          <div className="form-group">
            <label>Chave PIX *</label>
            <input
              className="form-control"
              value={form['pix.key']}
              onChange={(e) => set('pix.key', e.target.value)}
              placeholder={form['pix.key_type'] === 'cpf' ? '000.000.000-00' : form['pix.key_type'] === 'cnpj' ? '00.000.000/0000-00' : form['pix.key_type'] === 'email' ? 'email@exemplo.com' : form['pix.key_type'] === 'phone' ? '+5511999999999' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Nome do Recebedor *</label>
            <input className="form-control" value={form['pix.merchant_name']} onChange={(e) => set('pix.merchant_name', e.target.value)} placeholder="Nome da empresa ou pessoa" maxLength={25} />
            <small style={{ color: '#9ca3af' }}>Máx. 25 caracteres</small>
          </div>
          <div className="form-group">
            <label>Cidade</label>
            <input className="form-control" value={form['pix.merchant_city']} onChange={(e) => set('pix.merchant_city', e.target.value)} placeholder="São Paulo" maxLength={15} />
            <small style={{ color: '#9ca3af' }}>Máx. 15 caracteres</small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <FiSave /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-outline" onClick={generatePreview}>
            Testar QR Code
          </button>
        </div>

        {preview && (
          <div style={{ textAlign: 'center', marginTop: 20, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
            <p style={{ fontWeight: 600, marginBottom: 8, color: '#15803d' }}>QR Code de Teste (R$ 1,00)</p>
            <img src={preview} alt="PIX QR Code Preview" style={{ width: 200, height: 200 }} />
            <p style={{ fontSize: '.75rem', color: '#6b7280', marginTop: 8 }}>Escaneie para verificar se está correto</p>
          </div>
        )}
      </form>
    </div>
  );
}

/* ───── Empresa Settings ───── */
function EmpresaSettings() {
  const [form, setForm] = useState({
    'empresa.nome': '',
    'empresa.cnpj': '',
    'empresa.telefone': '',
    'empresa.endereco': '',
    'empresa.cidade': '',
    'empresa.horario': '',
    'empresa.observacao_ticket': 'Guarde este ticket, ele deverá ser apresentado na entrega do brinquedo',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings', { params: { prefix: 'empresa.' } }).then(({ data }) => {
      if (data && typeof data === 'object') {
        setForm((prev) => ({ ...prev, ...data }));
      }
    }).catch(() => { });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/batch', form);
      toast.success('Dados da empresa salvos!');
    } catch { /* */ }
    finally { setSaving(false); }
  }

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="card">
      <div className="card-header"><h3>Dados da Empresa</h3></div>
      <form onSubmit={handleSave} style={{ padding: 20 }}>
        <p style={{ fontSize: '.85rem', color: '#6b7280', marginBottom: 16 }}>
          Estes dados serão impressos nos tickets/recibos de locação e finalização.
        </p>

        <div className="form-row">
          <div className="form-group">
            <label>Nome da Empresa</label>
            <input className="form-control" value={form['empresa.nome']} onChange={(e) => set('empresa.nome', e.target.value)} />
          </div>
          <div className="form-group">
            <label>CNPJ</label>
            <input className="form-control" value={form['empresa.cnpj']} onChange={(e) => set('empresa.cnpj', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Telefone</label>
            <input className="form-control" value={form['empresa.telefone']} onChange={(e) => set('empresa.telefone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Horário de Funcionamento</label>
            <input className="form-control" value={form['empresa.horario']} onChange={(e) => set('empresa.horario', e.target.value)} placeholder="Seg a Sex das 10:00 as 22:00" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Endereço</label>
            <input className="form-control" value={form['empresa.endereco']} onChange={(e) => set('empresa.endereco', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Cidade / UF</label>
            <input className="form-control" value={form['empresa.cidade']} onChange={(e) => set('empresa.cidade', e.target.value)} placeholder="São Paulo, SP" />
          </div>
        </div>

        <div className="form-group">
          <label>Observação no Ticket</label>
          <textarea className="form-control" rows={2} value={form['empresa.observacao_ticket']} onChange={(e) => set('empresa.observacao_ticket', e.target.value)} placeholder="Ex: Guarde este ticket, ele deverá ser apresentado na entrega do brinquedo" />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <FiSave /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───── Ticket Settings ───── */
function TicketSettings() {
  const [form, setForm] = useState({
    'ticket.imprimir_empresa': '1',
    'ticket.imprimir_cnpj': '1',
    'ticket.imprimir_telefone': '1',
    'ticket.imprimir_horario': '1',
    'ticket.imprimir_endereco': '1',
    'ticket.imprimir_observacao': '1',
    'ticket.imprimir_crianca': '1',
    'ticket.imprimir_tempo_tolerancia': '1',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings', { params: { prefix: 'ticket.' } }).then(({ data }) => {
      if (data && typeof data === 'object') {
        setForm((prev) => ({ ...prev, ...data }));
      }
    }).catch(() => { });
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/batch', form);
      toast.success('Configurações de ticket salvas!');
    } catch { /* */ }
    finally { setSaving(false); }
  }

  const toggle = (key: string) => setForm((p) => ({ ...p, [key]: p[key as keyof typeof p] === '1' ? '0' : '1' }));

  return (
    <div className="card">
      <div className="card-header"><h3>Configurações do Ticket</h3></div>
      <form onSubmit={handleSave} style={{ padding: 20 }}>
        <p style={{ fontSize: '.85rem', color: '#6b7280', marginBottom: 16 }}>
          Configure quais informações serão impressas nos tickets de locação e finalização.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'ticket.imprimir_empresa', label: 'Imprimir nome da empresa' },
            { key: 'ticket.imprimir_cnpj', label: 'Imprimir CNPJ' },
            { key: 'ticket.imprimir_telefone', label: 'Imprimir telefone' },
            { key: 'ticket.imprimir_horario', label: 'Imprimir horário de funcionamento' },
            { key: 'ticket.imprimir_endereco', label: 'Imprimir endereço' },
            { key: 'ticket.imprimir_observacao', label: 'Imprimir observação' },
            { key: 'ticket.imprimir_crianca', label: 'Imprimir nome da criança' },
            { key: 'ticket.imprimir_tempo_tolerancia', label: 'Imprimir tempo de tolerância (se houver)' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
              <input
                type="checkbox"
                checked={form[key as keyof typeof form] === '1'}
                onChange={() => toggle(key)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: '.9rem' }}>{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <FiSave /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
