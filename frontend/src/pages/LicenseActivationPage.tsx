import { useState, useEffect, type FormEvent } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface LicenseStatus {
  licensed: boolean;
  key?: string | null;
  plan?: string | null;
  product?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  machineId?: string | null;
}

export default function LicenseActivationPage() {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    setChecking(true);
    try {
      const { data } = await api.get('/license/status');
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }

  function formatKey(raw: string): string {
    const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
    const parts: string[] = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.slice(i, i + 4));
    }
    return parts.join('-');
  }

  function handleKeyChange(value: string) {
    setKey(formatKey(value));
  }

  async function handleActivate(e: FormEvent) {
    e.preventDefault();
    if (!key || key.length !== 19) {
      toast.error('Digite uma chave válida no formato XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/license/activate', { key });
      if (data.success) {
        toast.success(data.message || 'Licença ativada com sucesso!');
        await checkStatus();
        // Redireciona para o login após ativação
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        toast.error(data.message || 'Falha na ativação.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao ativar licença.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="license-page">
        <div className="license-card">
          <div className="loading-spinner"><div className="spinner" /></div>
          <p style={{ textAlign: 'center', marginTop: 16 }}>Verificando licença...</p>
        </div>
      </div>
    );
  }

  if (status?.licensed) {
    return (
      <div className="license-page">
        <div className="license-card">
          <div className="license-icon">✅</div>
          <h1>Sistema Licenciado</h1>
          <div className="license-info">
            <div className="info-row">
              <span className="info-label">Chave:</span>
              <span className="info-value">{status.key}</span>
            </div>
            {status.plan && (
              <div className="info-row">
                <span className="info-label">Plano:</span>
                <span className="info-value">{status.plan}</span>
              </div>
            )}
            {status.product && (
              <div className="info-row">
                <span className="info-label">Produto:</span>
                <span className="info-value">{status.product}</span>
              </div>
            )}
            {status.activatedAt && (
              <div className="info-row">
                <span className="info-label">Ativado em:</span>
                <span className="info-value">
                  {new Date(status.activatedAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
            {status.expiresAt && (
              <div className="info-row">
                <span className="info-label">Expira em:</span>
                <span className="info-value">
                  {new Date(status.expiresAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => (window.location.href = '/login')}
            style={{ marginTop: 24, width: '100%' }}
          >
            Acessar sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="license-page">
      <div className="license-card">
        <div className="license-icon">🔑</div>
        <h1>Ativação de Licença</h1>
        <p>Digite sua chave de licença para ativar o sistema</p>

        <form onSubmit={handleActivate}>
          <div className="form-group">
            <label>Chave de Licença</label>
            <input
              className="form-control license-input"
              type="text"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || key.length !== 19}
            style={{ width: '100%' }}
          >
            {loading ? 'Ativando...' : 'Ativar Licença'}
          </button>
        </form>

        <div className="license-help">
          <p>
            Entre em contato com o administrador para obter sua chave de licença.
            <br />
            Formato: <strong>XXXX-XXXX-XXXX-XXXX</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
