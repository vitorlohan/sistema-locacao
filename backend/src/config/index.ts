import path from 'path';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}

// ── Persistent secrets management ──
// Secrets are auto-generated on first run and persisted in the data directory.
// No hardcoded secrets in source code. Override via environment variables.

interface PersistedSecrets {
  jwtSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  licenseSecret: string;
}

function getSecretsFilePath(): string {
  const dbPath = path.resolve(process.env.DB_PATH || './data/locacao.db');
  return path.join(path.dirname(dbPath), '.secrets.json');
}

function loadOrGenerateSecrets(): PersistedSecrets {
  const secretsPath = getSecretsFilePath();

  // 1. Try loading existing persisted secrets
  try {
    if (fs.existsSync(secretsPath)) {
      const data = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
      if (data.jwtSecret && data.jwtRefreshSecret && data.encryptionKey && data.licenseSecret) {
        return data;
      }
    }
  } catch {
    console.warn('[Config] Falha ao ler .secrets.json, regenerando...');
  }

  // 2. Generate new unique secrets for this installation
  const secrets: PersistedSecrets = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    jwtRefreshSecret: crypto.randomBytes(32).toString('hex'),
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    licenseSecret: crypto.randomBytes(24).toString('hex'),
  };

  // 3. Persist to data directory
  try {
    const dir = path.dirname(secretsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), 'utf-8');
    console.log('[Config] Secrets gerados e salvos com sucesso.');
  } catch (err: any) {
    console.warn('[Config] Não foi possível salvar secrets:', err.message);
  }

  return secrets;
}

const secrets = loadOrGenerateSecrets();

const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: '0.0.0.0',
    localIP: getLocalIP(),
  },

  database: {
    path: path.resolve(process.env.DB_PATH || './data/locacao.db'),
  },

  jwt: {
    secret: process.env.JWT_SECRET || secrets.jwtSecret,
    refreshSecret: process.env.JWT_REFRESH_SECRET || secrets.jwtRefreshSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || secrets.encryptionKey,
  },

  backup: {
    dir: path.resolve(process.env.BACKUP_DIR || './backups'),
    intervalMs: parseInt(process.env.BACKUP_INTERVAL_MS || String(4 * 60 * 60 * 1000), 10), // 4 hours
    maxBackups: parseInt(process.env.MAX_BACKUPS || '10', 10),
  },

  rental: {
    lateFeePerMinute: true, // late fee calculated per minute based on rental value/duration
    minRentalMinutes: 30,
  },

  security: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10),
    lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '15', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
    loginRateLimitMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
    maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10),
  },

  license: {
    serverUrl: process.env.LICENSE_SERVER_URL || 'https://central-licencas.onrender.com',
    secret: process.env.LICENSE_SECRET || secrets.licenseSecret,
    storagePath: path.resolve(process.env.LICENSE_PATH || './.license'),
  },
};

export default config;
