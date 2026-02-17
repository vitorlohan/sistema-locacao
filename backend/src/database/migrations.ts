import { getDatabase } from './connection';

const migrations: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin', 'operator')),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `,
  },
  {
    version: 2,
    name: 'create_clients',
    sql: `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        document TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        observations TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `,
  },
  {
    version: 3,
    name: 'create_items',
    sql: `
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        internal_code TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        rental_value REAL NOT NULL,
        rental_period TEXT NOT NULL DEFAULT 'hour' CHECK(rental_period IN ('hour', 'day', 'week', 'month')),
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'rented', 'maintenance')),
        observations TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `,
  },
  {
    version: 4,
    name: 'create_rentals',
    sql: `
      CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        expected_end_date TEXT NOT NULL,
        actual_end_date TEXT,
        rental_value REAL NOT NULL,
        deposit REAL NOT NULL DEFAULT 0,
        late_fee REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        total_value REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled', 'overdue')),
        observations TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (item_id) REFERENCES items(id)
      );
    `,
  },
  {
    version: 5,
    name: 'create_payments',
    sql: `
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rental_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'transfer', 'other')),
        payment_date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (rental_id) REFERENCES rentals(id)
      );
    `,
  },
  {
    version: 6,
    name: 'create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `,
  },
  {
    version: 7,
    name: 'create_sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_jti TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        refresh_expires_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_jti ON sessions(token_jti);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
    `,
  },
  {
    version: 8,
    name: 'create_login_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        user_id INTEGER,
        success INTEGER NOT NULL DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        failure_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_login_logs_email ON login_logs(email);
      CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);
    `,
  },
  {
    version: 9,
    name: 'create_audit_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `,
  },
  {
    version: 10,
    name: 'add_user_security_columns',
    sql: `
      ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN locked_until TEXT;
    `,
  },
  {
    version: 11,
    name: 'create_cash_registers',
    sql: `
      CREATE TABLE IF NOT EXISTS cash_registers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        opening_balance REAL NOT NULL DEFAULT 0,
        closing_balance REAL,
        total_entries REAL NOT NULL DEFAULT 0,
        total_exits REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
        observations TEXT,
        opened_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        closed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_cash_registers_user_id ON cash_registers(user_id);
      CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);
      CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at);
    `,
  },
  {
    version: 13,
    name: 'create_item_pricing',
    sql: `
      CREATE TABLE IF NOT EXISTS item_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        label TEXT NOT NULL,
        price REAL NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_item_pricing_item_id ON item_pricing(item_id);
    `,
  },
  {
    version: 12,
    name: 'create_cash_transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cash_register_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('entry', 'exit')),
        category TEXT NOT NULL CHECK(category IN ('rental_payment', 'deposit', 'refund', 'expense', 'adjustment', 'withdrawal', 'supply', 'other')),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'transfer', 'other')),
        reference_type TEXT,
        reference_id INTEGER,
        user_id INTEGER NOT NULL,
        cancelled INTEGER NOT NULL DEFAULT 0,
        cancelled_at TEXT,
        cancelled_by INTEGER,
        cancellation_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (cancelled_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_register ON cash_transactions(cash_register_id);
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON cash_transactions(type);
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at ON cash_transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_cancelled ON cash_transactions(cancelled);
    `,
  },
  {
    version: 14,
    name: 'add_rentals_pricing_duration',
    sql: `
      ALTER TABLE rentals ADD COLUMN pricing_duration_minutes INTEGER;
    `,
  },
  {
    version: 15,
    name: 'fix_timestamps_to_localtime',
    sql: `
      UPDATE clients SET created_at = datetime(created_at, 'localtime'), updated_at = datetime(updated_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE items SET created_at = datetime(created_at, 'localtime'), updated_at = datetime(updated_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE rentals SET created_at = datetime(created_at, 'localtime'), updated_at = datetime(updated_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE payments SET payment_date = datetime(payment_date, 'localtime'), created_at = datetime(created_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE cash_registers SET opened_at = datetime(opened_at, 'localtime'), created_at = datetime(created_at, 'localtime'), updated_at = datetime(updated_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE cash_registers SET closed_at = datetime(closed_at, 'localtime') WHERE closed_at IS NOT NULL AND closed_at LIKE '%-%-% %:%:%' AND closed_at NOT LIKE '%T%';
      UPDATE cash_transactions SET created_at = datetime(created_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE cash_transactions SET cancelled_at = datetime(cancelled_at, 'localtime') WHERE cancelled_at IS NOT NULL AND cancelled_at LIKE '%-%-% %:%:%' AND cancelled_at NOT LIKE '%T%';
      UPDATE sessions SET created_at = datetime(created_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE login_logs SET created_at = datetime(created_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
      UPDATE audit_logs SET created_at = datetime(created_at, 'localtime') WHERE created_at LIKE '%-%-% %:%:%' AND created_at NOT LIKE '%T%';
    `,
  },
];

export function runMigrations(): void {
  const db = getDatabase();

  // Always create migrations table first
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  const applied = db
    .prepare('SELECT version FROM migrations ORDER BY version')
    .all() as { version: number }[];

  const appliedVersions = new Set(applied.map((m) => m.version));

  const insertMigration = db.prepare(
    'INSERT INTO migrations (version, name) VALUES (?, ?)'
  );

  const transaction = db.transaction(() => {
    for (const migration of migrations) {
      if (migration.name === 'create_migrations_table') continue;
      if (appliedVersions.has(migration.version)) continue;

      console.log(`  Aplicando migração ${migration.version}: ${migration.name}`);
      db.exec(migration.sql);
      insertMigration.run(migration.version, migration.name);
    }
  });

  transaction();
  console.log('✓ Migrações aplicadas com sucesso');
}
