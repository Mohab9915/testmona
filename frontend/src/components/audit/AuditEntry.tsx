import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDateFormat } from '@/hooks/useDateFormat';
import { useTranslation } from '@/hooks/useTranslation';
import type { AuditTrail } from '@/types';
import {
  ACTION_TONE,
  DEFAULT_ENTITY_ICON,
  DEFAULT_TONE,
  ENTITY_ICONS,
  deriveFieldChanges,
  formatAuditValue,
  humanize,
} from './auditPresentation';

interface Props {
  entry: AuditTrail;
  /** Hide the entity chip on a detail page, where every row is the same entity. */
  showEntity?: boolean;
}

export function AuditEntry({ entry, showEntity = true }: Props) {
  const { t } = useTranslation();
  const { formatDateTime } = useDateFormat();
  const [expanded, setExpanded] = useState(false);

  const changes = deriveFieldChanges(entry.field_changes, entry.old_values, entry.new_values);
  const tone = ACTION_TONE[entry.action] ?? DEFAULT_TONE;
  const icon = ENTITY_ICONS[entry.entity_type] ?? DEFAULT_ENTITY_ICON;

  // Prefer a translated label; fall back to the humanised enum value so a new
  // backend action never renders as a raw snake_case token.
  const actionLabel = t(`auditAction_${entry.action}`) === `auditAction_${entry.action}`
    ? humanize(entry.action)
    : t(`auditAction_${entry.action}`);
  const entityLabel = t(`auditEntity_${entry.entity_type}`) === `auditEntity_${entry.entity_type}`
    ? humanize(entry.entity_type)
    : t(`auditEntity_${entry.entity_type}`);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-start gap-3 p-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={tone}>{actionLabel}</Badge>
            {showEntity && (
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {entityLabel}
                {entry.entity_id != null && (
                  <span className="text-slate-500 dark:text-slate-400"> #{entry.entity_id}</span>
                )}
              </span>
            )}
            {changes.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {t('auditFieldsChanged', { count: changes.length })}
              </Badge>
            )}
          </div>

          {entry.description && (
            <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-400">
              {entry.description}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {entry.user_full_name || entry.username || `#${entry.user_id}`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(entry.created_at)}
            </span>
          </div>
        </div>

        {changes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            )}
          </Button>
        )}
      </div>

      {expanded && changes.length > 0 && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="space-y-2">
            {changes.map((c) => (
              <div key={c.field} className="text-sm">
                <div className="mb-1 font-medium text-slate-700 dark:text-slate-300">
                  {humanize(c.field)}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="overflow-x-auto rounded border border-rose-200 bg-rose-50 p-2 dark:border-rose-900 dark:bg-rose-950/30">
                    <div className="mb-0.5 text-xs text-rose-700 dark:text-rose-400">
                      {t('auditBefore')}
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {formatAuditValue(c.from)}
                    </pre>
                  </div>
                  <div className="overflow-x-auto rounded border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="mb-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                      {t('auditAfter')}
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {formatAuditValue(c.to)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
