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

export function isViewerRole(role?: string | null): boolean {
  return normalizeRole(role) === USER_ROLES.VIEWER;
}

/**
 * Whether a user may perform write actions (create/edit/delete/execute content).
 * Superusers always can; known viewers cannot; any other/unknown role is allowed
 * (the backend still enforces RBAC — incl. the viewer read-only guard — as the
 * source of truth, so this is UX gating only).
 */
export function canWrite(user?: { role?: string | null; is_superuser?: boolean } | null): boolean {
  return Boolean(user?.is_superuser) || !isViewerRole(user?.role);
}

/**
 * Backwards-compatible alias for {@link canWrite}, kept so existing call sites
 * (test execution, requirements) don't need to change.
 */
export const canWriteResults = canWrite;

/**
 * Whether a (project-level) role grants write access. Mirrors the backend
 * ROLE_PERMISSIONS table: admin/manager/tester can write, viewer cannot.
 * Unknown roles default to read-only (the backend stays the source of truth).
 */
export function roleCanWrite(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === USER_ROLES.ADMIN ||
    normalized === USER_ROLES.MANAGER ||
    normalized === USER_ROLES.TESTER
  );
}

/**
 * Whether the current user may record execution work on a given test run.
 *
 * Mirrors `rbac.can_execute_test_run` on the backend: a role that can author runs
 * in the project (`write`) may execute any of them, while an execute-only role
 * (tester) works exclusively on the runs assigned to it — never a colleague's run
 * and never an unassigned one. UX gating only; the backend still enforces it.
 */
export function canExecuteTestRun(
  run: { assigned_to?: number | string | null } | null | undefined,
  perms: { canWrite: boolean; canExecute: boolean },
  userId?: number | string | null,
): boolean {
  if (!run) return false;
  if (perms.canWrite) return true;
  if (!perms.canExecute) return false;
  if (run.assigned_to == null || userId == null) return false;
  return Number(run.assigned_to) === Number(userId);
}
