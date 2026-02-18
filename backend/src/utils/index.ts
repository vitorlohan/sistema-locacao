export { encrypt, decrypt } from './encryption';
export { AppError, NotFoundError, UnauthorizedError, ConflictError, ValidationError, ForbiddenError, TooManyRequestsError } from './errors';
export { PERMISSIONS, hasPermission } from './permissions';
export type { Permission } from './permissions';

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function diffInHours(start: Date, end: Date): number {
  return Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export function diffInDays(start: Date, end: Date): number {
  return Math.ceil(diffInHours(start, end) / 24);
}

/** Returns current Brasilia time (UTC-3) as ISO-like string (YYYY-MM-DDTHH:mm:ss) */
export function localNow(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Returns SQL expression for current Brasilia time — use in raw SQL */
export const SQL_NOW = "datetime('now','localtime')";
