import path from 'path';
import os from 'os';

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
    secret: process.env.JWT_SECRET || 'sistema-locacao-secret-key-offline-2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'sistema-locacao-refresh-secret-2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'locacao-encryption-key-32chars!!',
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
    secret: process.env.LICENSE_SECRET || 'sistema-locacao-license-secret-2026!',
    storagePath: path.resolve(process.env.LICENSE_PATH || './.license'),
  },
};

export default config;
