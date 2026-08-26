import React from 'react';
import {
  Activity,
  FileText,
  FolderTree,
  GitBranch,
  Package,
  Play,
  Settings,
  Target,
  Users,
} from 'lucide-react';

/**
 * Shared presentation for audit entries.
 *
 * The action palette deliberately mirrors `components/reports/ActivitySection.tsx`
 * so the activity page and the reports breakdown read as one system.
 */
export const ACTION_TONE: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  update: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  delete: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  execute: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300',
  login: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300',
  logout: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  approve: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  reject: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
  restore: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
  archive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export const DEFAULT_TONE = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

export const ENTITY_ICONS: Record<string, React.ReactNode> = {
  test_case: <FileText className="h-4 w-4" />,
  test_suite: <Package className="h-4 w-4" />,
  test_run: <Play className="h-4 w-4" />,
  test_result: <Play className="h-4 w-4" />,
  test_plan: <FolderTree className="h-4 w-4" />,
  requirement: <FileText className="h-4 w-4" />,
  defect: <Activity className="h-4 w-4" />,
  milestone: <Target className="h-4 w-4" />,
  user: <Users className="h-4 w-4" />,
  project: <Package className="h-4 w-4" />,
  system_setting: <Settings className="h-4 w-4" />,
};

export const DEFAULT_ENTITY_ICON = <GitBranch className="h-4 w-4" />;

/** `test_case` -> `test case`. Used as the fallback when no translation exists. */
export const humanize = (value: string) => String(value || '').replace(/_/g, ' ').trim();

/**
 * Entity types the activity filter offers. Deliberately a curated subset of the
 * 30 the backend enumerates — the rest are internal and would bury the ones a
 * QA team actually looks for.
 */
export const FILTERABLE_ENTITY_TYPES = [
  'test_case',
  'test_suite',
  'test_run',
  'test_result',
  'test_plan',
  'requirement',
  'defect',
  'milestone',
  'shared_step',
  'custom_field',
  'project',
] as const;

export const FILTERABLE_ACTIONS = [
  'create',
  'update',
  'delete',
  'execute',
  'assign',
  'approve',
  'reject',
  'archive',
  'restore',
  'import',
  'export',
  'sync',
] as const;

/** Render a value from old_values/new_values without exploding on objects. */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Normalise the three shapes the backend stores changes in.
 *
 * `field_changes` is preferred when present. Otherwise the diff is derived by
 * walking the union of `old_values` and `new_values` keys, which is what most
 * call sites actually write.
 */
export function deriveFieldChanges(
  fieldChanges?: Record<string, unknown> | null,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
): Array<{ field: string; from: unknown; to: unknown }> {
  if (fieldChanges && Object.keys(fieldChanges).length > 0) {
    return Object.entries(fieldChanges).map(([field, change]) => {
      if (change && typeof change === 'object' && !Array.isArray(change)) {
        const rec = change as Record<string, unknown>;
        if ('from' in rec || 'to' in rec) return { field, from: rec.from, to: rec.to };
        if ('old' in rec || 'new' in rec) return { field, from: rec.old, to: rec.new };
      }
      return { field, from: oldValues?.[field], to: change };
    });
  }

  const keys = new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]);
  return Array.from(keys)
    .map((field) => ({ field, from: oldValues?.[field], to: newValues?.[field] }))
    .filter((c) => formatAuditValue(c.from) !== formatAuditValue(c.to));
}
