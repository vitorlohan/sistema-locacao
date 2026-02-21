import { getDatabase } from '../../database';

export class SettingsService {
  get(key: string): string | null {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getAll(): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  getByPrefix(prefix: string): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all(`${prefix}%`) as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  set(key: string, value: string): void {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value);
  }

  setMany(entries: Record<string, string>): void {
    const db = getDatabase();
    const stmt = db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        stmt.run(key, value);
      }
    });
    tx();
  }

  delete(key: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

export const settingsService = new SettingsService();
