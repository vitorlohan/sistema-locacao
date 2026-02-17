import { useEffect, useState, useCallback } from 'react';
import {
  FiDatabase, FiDownloadCloud, FiUploadCloud, FiTrash2,
  FiRefreshCw, FiSettings, FiSave, FiHardDrive, FiClock,
  FiArchive, FiAlertTriangle, FiCheck, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import { fmtDateTime } from '../utils/helpers';
import ConfirmDialog from '../components/ConfirmDialog';

/* ── Types ── */
interface BackupInfo {
  name: string;
  size: number;
  compressed: boolean;
  createdAt: string;
}

interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup: string | null;
  newestBackup: string | null;
  settings: BackupSettings;
}

interface BackupSettings {
  intervalMs: number;
  maxBackups: number;
  retentionDays: number;
  autoEnabled: boolean;
}

/* ── Helpers ── */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const INTERVAL_OPTIONS = [
  { label: '1 hora', value: 3600000 },
  { label: '2 horas', value: 7200000 },
  { label: '4 horas', value: 14400000 },
  { label: '6 horas', value: 21600000 },
  { label: '12 horas', value: 43200000 },
  { label: '24 horas (diário)', value: 86400000 },
];

/* ── Component ── */
export default function BackupPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<BackupSettings>({
    intervalMs: 86400000,
    maxBackups: 10,
    retentionDays: 30,
    autoEnabled: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bkRes, stRes] = await Promise.all([
        api.get<BackupInfo[]>('/backup/list'),
        api.get<BackupStats>('/backup/stats'),
      ]);
      setBackups(bkRes.data);
      setStats(stRes.data);
      setSettingsForm(stRes.data.settings);
    } catch {
      toast.error('Erro ao carregar backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Create manual backup ── */
  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post('/backup/create');
      toast.success('Backup criado com sucesso!');
      load();
    } catch {
      toast.error('Erro ao criar backup');
    } finally {
      setCreating(false);
    }
  };

  /* ── Restore ── */
  const handleRestore = async (filename: string) => {
    setRestoring(true);
    try {
      await api.post('/backup/restore', { filename });
      toast.success('Backup restaurado! O sistema pode precisar ser reiniciado.');
      setConfirmRestore(null);
      load();
    } catch {
      toast.error('Erro ao restaurar backup');
    } finally {
      setRestoring(false);
    }
  };

  /* ── Download ── */
  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar backup');
    }
  };

  /* ── Delete ── */
  const handleDelete = async (filename: string) => {
    try {
      await api.delete(`/backup/delete/${filename}`);
      toast.success('Backup excluído');
      setConfirmDelete(null);
      load();
    } catch {
      toast.error('Erro ao excluir backup');
    }
  };

  /* ── Save settings ── */
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/backup/settings', settingsForm);
      toast.success('Configurações salvas');
      setShowSettings(false);
      load();
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading && backups.length === 0) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="page-container">
      {/* ── Stats Cards ── */}
      {stats && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><FiArchive /></div>
            <div><div className="stat-value">{stats.totalBackups}</div><div className="stat-label">Total de Backups</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}><FiHardDrive /></div>
            <div><div className="stat-value">{fmtSize(stats.totalSize)}</div><div className="stat-label">Espaço Utilizado</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><FiClock /></div>
            <div><div className="stat-value">{stats.newestBackup ? fmtDateTime(stats.newestBackup) : '-'}</div><div className="stat-label">Último Backup</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: stats.settings.autoEnabled ? '#dcfce7' : '#fee2e2', color: stats.settings.autoEnabled ? '#16a34a' : '#dc2626' }}>
              {stats.settings.autoEnabled ? <FiCheck /> : <FiX />}
            </div>
            <div>
              <div className="stat-value">{stats.settings.autoEnabled ? 'Ativo' : 'Desativado'}</div>
              <div className="stat-label">Backup Automático</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions Bar ── */}
      <div className="toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? <><FiRefreshCw className="spin" /> Criando...</> : <><FiDatabase /> Criar Backup Manual</>}
        </button>
        <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>
          <FiSettings /> Configurações
        </button>
        <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 'auto' }}>
          <FiRefreshCw /> Atualizar
        </button>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="card" style={{ marginBottom: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiSettings /> Configurações de Backup
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <label className="form-group">
              <span className="form-label">Backup Automático</span>
              <select
                className="form-input"
                value={settingsForm.autoEnabled ? '1' : '0'}
                onChange={(e) => setSettingsForm({ ...settingsForm, autoEnabled: e.target.value === '1' })}
              >
                <option value="1">Ativado</option>
                <option value="0">Desativado</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Intervalo</span>
              <select
                className="form-input"
                value={settingsForm.intervalMs}
                onChange={(e) => setSettingsForm({ ...settingsForm, intervalMs: Number(e.target.value) })}
                disabled={!settingsForm.autoEnabled}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Máximo de Backups</span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={100}
                value={settingsForm.maxBackups}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxBackups: Number(e.target.value) })}
              />
            </label>
            <label className="form-group">
              <span className="form-label">Retenção (dias)</span>
              <input
                className="form-input"
                type="number"
                min={1}
                max={365}
                value={settingsForm.retentionDays}
                onChange={(e) => setSettingsForm({ ...settingsForm, retentionDays: Number(e.target.value) })}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
              <FiSave /> {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Backup List ── */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Tipo</th>
                <th>Tamanho</th>
                <th>Comprimido</th>
                <th>Data</th>
                <th style={{ width: 200 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    <FiArchive style={{ fontSize: 32, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    Nenhum backup encontrado. Clique em "Criar Backup Manual" para começar.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.name}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{b.name}</td>
                    <td>
                      <span className={`badge ${b.name.includes('-auto-') ? 'badge-info' : 'badge-success'}`}>
                        {b.name.includes('-auto-') ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td>{fmtSize(b.size)}</td>
                    <td>{b.compressed ? <FiCheck style={{ color: '#16a34a' }} /> : <FiX style={{ color: '#94a3b8' }} />}</td>
                    <td>{fmtDateTime(b.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Baixar"
                          onClick={() => handleDownload(b.name)}
                        >
                          <FiDownloadCloud />
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          title="Restaurar"
                          onClick={() => setConfirmRestore(b.name)}
                        >
                          <FiUploadCloud />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          title="Excluir"
                          onClick={() => setConfirmDelete(b.name)}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Excluir Backup"
          message={`Tem certeza que deseja excluir o backup "${confirmDelete}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Confirm Restore ── */}
      {confirmRestore && (
        <ConfirmDialog
          title="Restaurar Backup"
          message={
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', marginBottom: 12 }}>
                <FiAlertTriangle size={20} />
                <strong>Atenção!</strong>
              </div>
              <p>Restaurar o backup <strong>"{confirmRestore}"</strong> irá substituir todos os dados atuais.</p>
              <p>Um backup de segurança será criado automaticamente antes da restauração.</p>
              <p>O sistema pode precisar ser <strong>reiniciado</strong> após a restauração.</p>
            </>
          }
          confirmLabel={restoring ? 'Restaurando...' : 'Restaurar'}
          onConfirm={() => handleRestore(confirmRestore)}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  );
}
