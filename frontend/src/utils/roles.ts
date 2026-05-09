export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TESTER: 'tester',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function normalizeRole(role?: string | null): string {
  return role?.trim().toLowerCase() ?? '';
}

export function isAdminRole(role?: string | null): boolean {
  return normalizeRole(role) === USER_ROLES.ADMIN;
}

export function isAdminUser(user?: { role?: string | null; is_superuser?: boolean } | null): boolean {
  return Boolean(user?.is_superuser || isAdminRole(user?.role));
}
