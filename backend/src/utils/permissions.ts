export type Permission = string;

export const PERMISSIONS = {
  // Users
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Clients
  CLIENTS_CREATE: 'clients:create',
  CLIENTS_READ: 'clients:read',
  CLIENTS_UPDATE: 'clients:update',
  CLIENTS_DELETE: 'clients:delete',

  // Items
  ITEMS_CREATE: 'items:create',
  ITEMS_READ: 'items:read',
  ITEMS_UPDATE: 'items:update',
  ITEMS_DELETE: 'items:delete',

  // Rentals
  RENTALS_CREATE: 'rentals:create',
  RENTALS_READ: 'rentals:read',
  RENTALS_UPDATE: 'rentals:update',
  RENTALS_CANCEL: 'rentals:cancel',

  // Payments
  PAYMENTS_CREATE: 'payments:create',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_DELETE: 'payments:delete',

  // Reports
  REPORTS_READ: 'reports:read',

  // Backup
  BACKUP_CREATE: 'backup:create',
  BACKUP_LIST: 'backup:list',
  BACKUP_RESTORE: 'backup:restore',

  // Logs
  LOGS_READ: 'logs:read',

  // Sessions
  SESSIONS_READ: 'sessions:read',
  SESSIONS_REVOKE: 'sessions:revoke',

  // Caixa (Cash Register)
  CASHIER_OPEN: 'cashier:open',
  CASHIER_CLOSE: 'cashier:close',
  CASHIER_READ: 'cashier:read',
  CASHIER_ENTRY: 'cashier:entry',
  CASHIER_EXIT: 'cashier:exit',
  CASHIER_CANCEL: 'cashier:cancel',
  CASHIER_REPORT: 'cashier:report',
} as const;

/**
 * Permissões padrão por papel (role).
 * Admin tem todas as permissões automaticamente.
 * Operator tem um subconjunto.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: Object.values(PERMISSIONS),
  operator: [
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_UPDATE,
    PERMISSIONS.ITEMS_READ,
    PERMISSIONS.RENTALS_CREATE,
    PERMISSIONS.RENTALS_READ,
    PERMISSIONS.RENTALS_UPDATE,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.CASHIER_OPEN,
    PERMISSIONS.CASHIER_CLOSE,
    PERMISSIONS.CASHIER_READ,
    PERMISSIONS.CASHIER_ENTRY,
    PERMISSIONS.CASHIER_EXIT,
    PERMISSIONS.CASHIER_REPORT,
  ],
};

/**
 * Verifica se um usuário tem a permissão necessária.
 * Admin sempre tem permissão.
 * Para outros roles, verifica no role padrão + permissões individuais.
 */
export function hasPermission(
  role: string,
  userPermissions: string[],
  requiredPermission: Permission
): boolean {
  // Admin always has all permissions
  if (role === 'admin') return true;

  // Check role-based permissions
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  if (rolePerms.includes(requiredPermission)) return true;

  // Check individual permissions granted to the user
  if (userPermissions.includes(requiredPermission)) return true;

  return false;
}
