import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  isAdminRole,
  isAdminUser,
  isViewerRole,
  canWrite,
  canWriteResults,
  canExecuteTestRun,
  USER_ROLES,
} from '@/utils/roles';

describe('normalizeRole', () => {
  it('lowercases and trims', () => {
    expect(normalizeRole('  ADMIN  ')).toBe('admin');
    expect(normalizeRole('Viewer')).toBe('viewer');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeRole(null)).toBe('');
    expect(normalizeRole(undefined)).toBe('');
  });
});

describe('isAdminRole', () => {
  it('returns true for admin (case-insensitive)', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('Admin')).toBe(true);
  });

  it('returns false for non-admin roles', () => {
    expect(isAdminRole('viewer')).toBe(false);
    expect(isAdminRole('tester')).toBe(false);
    expect(isAdminRole('manager')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('isAdminUser', () => {
  it('returns true when role is admin', () => {
    expect(isAdminUser({ role: 'admin', is_superuser: false })).toBe(true);
  });

  it('returns true when is_superuser regardless of role', () => {
    expect(isAdminUser({ role: 'viewer', is_superuser: true })).toBe(true);
    expect(isAdminUser({ role: 'tester', is_superuser: true })).toBe(true);
  });

  it('returns false for viewer without superuser', () => {
    expect(isAdminUser({ role: 'viewer', is_superuser: false })).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});

describe('isViewerRole', () => {
  it('returns true for viewer role (case-insensitive)', () => {
    expect(isViewerRole('viewer')).toBe(true);
    expect(isViewerRole('VIEWER')).toBe(true);
  });

  it('returns false for non-viewer roles', () => {
    expect(isViewerRole('admin')).toBe(false);
    expect(isViewerRole('tester')).toBe(false);
  });
});

describe('canWrite', () => {
  it('returns true for non-viewer roles', () => {
    for (const role of ['admin', 'manager', 'tester']) {
      expect(canWrite({ role, is_superuser: false })).toBe(true);
    }
  });

  it('returns false for viewer role', () => {
    expect(canWrite({ role: 'viewer', is_superuser: false })).toBe(false);
  });

  it('returns true for superuser even if viewer role', () => {
    expect(canWrite({ role: 'viewer', is_superuser: true })).toBe(true);
  });

  it('returns true for null/undefined user (no role → not viewer → writable)', () => {
    // canWrite: Boolean(undefined?.is_superuser) || !isViewerRole(undefined?.role)
    // = false || !false = true
    expect(canWrite(null)).toBe(true);
    expect(canWrite(undefined)).toBe(true);
  });

  it('returns true for user with unknown role', () => {
    expect(canWrite({ role: 'unknown_role', is_superuser: false })).toBe(true);
  });
});

describe('canWriteResults', () => {
  it('is an alias for canWrite', () => {
    expect(canWriteResults).toBe(canWrite);
  });
});

describe('USER_ROLES constants', () => {
  it('exports the four expected roles', () => {
    expect(USER_ROLES.ADMIN).toBe('admin');
    expect(USER_ROLES.MANAGER).toBe('manager');
    expect(USER_ROLES.TESTER).toBe('tester');
    expect(USER_ROLES.VIEWER).toBe('viewer');
  });
});

describe('canExecuteTestRun', () => {
  const authoring = { canWrite: true, canExecute: true };
  const executeOnly = { canWrite: false, canExecute: true };
  const readOnly = { canWrite: false, canExecute: false };

  it('lets an authoring role execute any run', () => {
    expect(canExecuteTestRun({ assigned_to: 9 }, authoring, 1)).toBe(true);
    expect(canExecuteTestRun({ assigned_to: null }, authoring, 1)).toBe(true);
  });

  it('lets an execute-only role work only its own run', () => {
    expect(canExecuteTestRun({ assigned_to: 1 }, executeOnly, 1)).toBe(true);
    expect(canExecuteTestRun({ assigned_to: 9 }, executeOnly, 1)).toBe(false);
  });

  it('does not let an execute-only role pick up an unassigned run', () => {
    expect(canExecuteTestRun({ assigned_to: null }, executeOnly, 1)).toBe(false);
    expect(canExecuteTestRun({}, executeOnly, 1)).toBe(false);
  });

  it('compares ids across string/number shapes', () => {
    expect(canExecuteTestRun({ assigned_to: '1' }, executeOnly, 1)).toBe(true);
  });

  it('returns false without a run, a user, or execute rights', () => {
    expect(canExecuteTestRun(null, authoring, 1)).toBe(false);
    expect(canExecuteTestRun({ assigned_to: 1 }, executeOnly, null)).toBe(false);
    expect(canExecuteTestRun({ assigned_to: 1 }, readOnly, 1)).toBe(false);
  });
});
