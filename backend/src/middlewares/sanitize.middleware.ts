import { Request, Response, NextFunction } from 'express';

/**
 * Sanitiza valores de string para prevenir XSS.
 * Remove null bytes, trim, e codifica entidades HTML básicas.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/\0/g, '')          // remove null bytes
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Sanitiza todas as propriedades de string de um objeto.
 * Pula campos sensíveis como password e tokens.
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const skipFields = new Set(['password', 'token', 'refresh_token', 'refreshToken']);
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (skipFields.has(key)) {
      sanitized[key] = val;
    } else {
      sanitized[key] = sanitizeValue(val);
    }
  }

  return sanitized;
}

/**
 * Middleware global que sanitiza req.body e req.params.
 * req.query é read-only no Express v5, então sanitizamos os valores individualmente.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeValue(req.params[key]) as string;
      }
    }
  }

  next();
}
