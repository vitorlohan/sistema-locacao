import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

const store: RateLimitStore = {};

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 5 * 60 * 1000);

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl', message = 'Muitas requisições. Tente novamente mais tarde.' } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = { count: 1, resetAt: now + windowMs };
      next();
      return;
    }

    store[key].count++;

    if (store[key].count > max) {
      throw new TooManyRequestsError(message);
    }

    next();
  };
}

export function loginRateLimit(options: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyPrefix: 'login',
    message: 'Muitas tentativas de login. Tente novamente mais tarde.',
  });
}
