import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/api';
import { useEntityHistory } from '@/hooks/queries/auditTrail';
import { useTranslation } from '@/hooks/useTranslation';
import { AuditEntry } from './AuditEntry';

interface Props {
  /** Backend EntityType value, e.g. 'test_case' or 'defect'. */
  entityType: string;
  entityId: number | null;
  enabled?: boolean;
  /** Cap the rendered rows; the total still reflects everything recorded. */
  limit?: number;
}

/**
 * Every recorded change to one entity, drawn from the audit trail. Drop this on
 * any detail page — it is entity-agnostic by design.
 */
export function EntityHistoryPanel({ entityType, entityId, enabled = true, limit }: Props) {
  const { t } = useTranslation();
  const historyQuery = useEntityHistory(entityType, entityId, enabled);

  const entries = historyQuery.data?.history ?? [];
  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          {t('changeHistory')}
          {historyQuery.data && (
            <Badge variant="outline">{historyQuery.data.total_changes}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historyQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('loadingActivity')}</p>
        ) : historyQuery.isError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {getApiErrorMessage(historyQuery.error, t('activityLoadFailed'))}
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noChangesRecorded')}</p>
        ) : (
          <div className="space-y-2">
            {shown.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} showEntity={false} />
            ))}
            {limit && entries.length > limit && (
              <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('auditMoreEntries', { count: entries.length - limit })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
