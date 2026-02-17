import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import config from '../config';

export interface BackupInfo {
  name: string;
  size: number;
  compressed: boolean;
  createdAt: string;
}

export interface BackupSettings {
  intervalMs: number;
  maxBackups: number;
  retentionDays: number;
  autoEnabled: boolean;
}

export class BackupService {
  private intervalId: NodeJS.Timeout | null = null;
  private settings: BackupSettings;
  private settingsPath: string;

  constructor() {
    this.settingsPath = path.join(config.backup.dir, '.backup-settings.json');
    this.settings = {
      intervalMs: config.backup.intervalMs,
      maxBackups: config.backup.maxBackups,
      retentionDays: 30,
      autoEnabled: true,
    };
  }

  start(): void {
    this.ensureBackupDir();
    this.loadSettings();

    if (this.settings.autoEnabled) {
      this.scheduleNext();
      console.log(`✓ Backup automático configurado (a cada ${this.settings.intervalMs / 1000 / 60} minutos)`);
    } else {
      console.log('✓ Backup automático desativado');
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private scheduleNext(): void {
    this.stop();
    if (!this.settings.autoEnabled) return;

    this.intervalId = setInterval(() => {
      try {
        this.createBackup(true);
      } catch (err) {
        console.error('✗ Erro no backup automático:', err);
      }
    }, this.settings.intervalMs);
  }

  /** Create a compressed .gz backup of the SQLite database */
  createBackup(auto = false): BackupInfo {
    this.ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = auto ? 'auto' : 'manual';
    const backupFileName = `backup-${prefix}-${timestamp}.db.gz`;
    const backupPath = path.join(config.backup.dir, backupFileName);

    try {
      const dbBuffer = fs.readFileSync(config.database.path);
      const compressed = zlib.gzipSync(dbBuffer, { level: 9 });
      fs.writeFileSync(backupPath, compressed);

      const stats = fs.statSync(backupPath);
      console.log(`✓ Backup criado: ${backupFileName} (${this.formatSize(stats.size)})`);

      this.cleanOldBackups();

      return {
        name: backupFileName,
        size: stats.size,
        compressed: true,
        createdAt: stats.birthtime.toISOString(),
      };
    } catch (error) {
      console.error('✗ Erro ao criar backup:', error);
      throw error;
    }
  }

  /** Restore from a backup file (supports both .gz and .db) */
  restoreBackup(backupFileName: string): void {
    const backupPath = path.join(config.backup.dir, backupFileName);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup não encontrado: ${backupFileName}`);
    }

    const resolved = path.resolve(config.backup.dir, backupFileName);
    if (!resolved.startsWith(path.resolve(config.backup.dir))) {
      throw new Error('Caminho de backup inválido');
    }

    try {
      // Safety backup before restoring
      this.createBackup(false);

      if (backupFileName.endsWith('.gz')) {
        const compressed = fs.readFileSync(backupPath);
        const decompressed = zlib.gunzipSync(compressed);
        fs.writeFileSync(config.database.path, decompressed);
      } else {
        fs.copyFileSync(backupPath, config.database.path);
      }

      console.log(`✓ Backup restaurado: ${backupFileName}`);
    } catch (error) {
      console.error('✗ Erro ao restaurar backup:', error);
      throw error;
    }
  }

  /** List all backups sorted newest first */
  listBackups(): BackupInfo[] {
    this.ensureBackupDir();
    const files = fs.readdirSync(config.backup.dir);
    return files
      .filter((f) => f.startsWith('backup-') && (f.endsWith('.db') || f.endsWith('.db.gz')))
      .map((f) => {
        const stats = fs.statSync(path.join(config.backup.dir, f));
        return {
          name: f,
          size: stats.size,
          compressed: f.endsWith('.gz'),
          createdAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Delete a specific backup */
  deleteBackup(backupFileName: string): void {
    const resolved = path.resolve(config.backup.dir, backupFileName);
    if (!resolved.startsWith(path.resolve(config.backup.dir))) {
      throw new Error('Caminho de backup inválido');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`Backup não encontrado: ${backupFileName}`);
    }
    fs.unlinkSync(resolved);
    console.log(`✓ Backup excluído: ${backupFileName}`);
  }

  /** Get the full path to a backup file (for downloads) */
  getBackupPath(backupFileName: string): string {
    const resolved = path.resolve(config.backup.dir, backupFileName);
    if (!resolved.startsWith(path.resolve(config.backup.dir))) {
      throw new Error('Caminho de backup inválido');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`Backup não encontrado: ${backupFileName}`);
    }
    return resolved;
  }

  /** Get backup folder stats */
  getStats(): { totalBackups: number; totalSize: number; oldestBackup: string | null; newestBackup: string | null; settings: BackupSettings } {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
      newestBackup: backups.length > 0 ? backups[0].createdAt : null,
      settings: { ...this.settings },
    };
  }

  /** Get current settings */
  getSettings(): BackupSettings {
    return { ...this.settings };
  }

  /** Update settings and restart scheduler */
  updateSettings(newSettings: Partial<BackupSettings>): BackupSettings {
    if (newSettings.intervalMs !== undefined) {
      if (newSettings.intervalMs < 60000) throw new Error('Intervalo mínimo: 1 minuto');
      this.settings.intervalMs = newSettings.intervalMs;
    }
    if (newSettings.maxBackups !== undefined) {
      if (newSettings.maxBackups < 1) throw new Error('Mínimo de 1 backup');
      this.settings.maxBackups = newSettings.maxBackups;
    }
    if (newSettings.retentionDays !== undefined) {
      if (newSettings.retentionDays < 1) throw new Error('Retenção mínima: 1 dia');
      this.settings.retentionDays = newSettings.retentionDays;
    }
    if (newSettings.autoEnabled !== undefined) {
      this.settings.autoEnabled = newSettings.autoEnabled;
    }

    this.saveSettings();

    if (this.settings.autoEnabled) {
      this.scheduleNext();
    } else {
      this.stop();
    }

    return { ...this.settings };
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(config.backup.dir)) {
      fs.mkdirSync(config.backup.dir, { recursive: true });
    }
  }

  private cleanOldBackups(): void {
    const backups = this.listBackups();

    // Remove by count limit
    if (backups.length > this.settings.maxBackups) {
      const toRemove = backups.slice(this.settings.maxBackups);
      for (const backup of toRemove) {
        const filePath = path.join(config.backup.dir, backup.name);
        fs.unlinkSync(filePath);
        console.log(`  Backup antigo removido (excedeu limite): ${backup.name}`);
      }
    }

    // Remove by retention age (keep at least 1)
    const cutoff = Date.now() - this.settings.retentionDays * 24 * 60 * 60 * 1000;
    const remaining = this.listBackups();
    if (remaining.length <= 1) return;

    for (let i = 1; i < remaining.length; i++) {
      const b = remaining[i];
      if (new Date(b.createdAt).getTime() < cutoff) {
        const filePath = path.join(config.backup.dir, b.name);
        fs.unlinkSync(filePath);
        console.log(`  Backup antigo removido (${this.settings.retentionDays}+ dias): ${b.name}`);
      }
    }
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        this.settings = { ...this.settings, ...data };
      }
    } catch {
      // Use defaults
    }
  }

  private saveSettings(): void {
    this.ensureBackupDir();
    fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const backupService = new BackupService();
