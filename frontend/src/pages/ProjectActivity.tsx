import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Activity, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuditEntry } from '@/components/audit/AuditEntry';
import {
  FILTERABLE_ACTIONS,
  FILTERABLE_ENTITY_TYPES,
  humanize,
} from '@/components/audit/auditPresentation';
import { getApiErrorMessage, usersAPI } from '@/lib/api';
import { useAuditTrails } from '@/hooks/queries/auditTrail';
import { useTranslation } from '@/hooks/useTranslation';
import type { AuditAction, AuditTrailFilters, EntityType } from '@/types';

const PAGE_SIZE = 50;
const ALL = '__all__';

const parsePositiveId = (value?: string): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export function ProjectActivity() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t, isRTL } = useTranslation();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const routeProjectId = useMemo(() => parsePositiveId(projectId), [projectId]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entityType, setEntityType] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);
  const [userId, setUserId] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  // Keep typing from firing a request per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  // Any filter change invalidates the current page offset.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, entityType, action, userId, dateFrom, dateTo]);

  const usersQuery = useQuery({
    queryKey: ['auditFilterUsers'],
    queryFn: () => usersAPI.getAll(0, 200),
    staleTime: 5 * 60 * 1000,
  });
  const users: Array<{ id: number; username: string; full_name?: string }> = Array.isArray(
    usersQuery.data,
  )
    ? usersQuery.data
    : (usersQuery.data?.items ?? []);

  const filters: AuditTrailFilters = useMemo(
    () => ({
      project_id: routeProjectId ?? undefined,
      entity_type: entityType === ALL ? undefined : (entityType as EntityType),
      action: action === ALL ? undefined : (action as AuditAction),
      user_id: userId === ALL ? undefined : Number(userId),
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [routeProjectId, entityType, action, userId, dateFrom, dateTo, debouncedSearch, page],
  );

  const auditQuery = useAuditTrails(filters, !!routeProjectId);

  const entries = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.total ?? 0;
  const hasFilters =
    !!debouncedSearch || entityType !== ALL || action !== ALL || userId !== ALL || !!dateFrom || !!dateTo;

  const resetFilters = () => {
    setSearch('');
    setEntityType(ALL);
    setAction(ALL);
    setUserId(ALL);
    setDateFrom('');
    setDateTo('');
  };

  const label = (prefix: string, value: string) => {
    const key = `${prefix}${value}`;
    const translated = t(key);
    return translated === key ? humanize(value) : translated;
  };

  if (!routeProjectId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-rose-600 dark:text-rose-400">{t('invalidProjectId')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/projects/${routeProjectId}`)}
            className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <BackIcon className="h-4 w-4" />
            {t('backToProject')}
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <Activity className="h-5 w-5" />
              {t('projectActivity')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('projectActivitySubtitle')}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchActivity')}
              className="ps-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue placeholder={t('allEntityTypes')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allEntityTypes')}</SelectItem>
                {FILTERABLE_ENTITY_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>{label('auditEntity_', v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue placeholder={t('allActions')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allActions')}</SelectItem>
                {FILTERABLE_ACTIONS.map((v) => (
                  <SelectItem key={v} value={v}>{label('auditAction_', v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder={t('allUsers')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allUsers')}</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label={t('dateFrom')}
            />
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label={t('dateTo')}
            />
          </div>

          {hasFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t('resetFilters')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {auditQuery.isError ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {getApiErrorMessage(auditQuery.error, t('activityLoadFailed'))}
            </p>
          </CardContent>
        </Card>
      ) : auditQuery.isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('loadingActivity')}</p>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Activity className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
            <p className="font-medium text-slate-700 dark:text-slate-300">{t('noActivityFound')}</p>
            {/* Distinguishes an empty filter result from a project that has
                simply never recorded anything yet. */}
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500 dark:text-slate-400">
              {hasFilters ? t('noActivityForFilters') : t('noActivityYetHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              {t('showingRange', {
                start: page * PAGE_SIZE + 1,
                end: page * PAGE_SIZE + entries.length,
                total,
              })}
            </span>
            {auditQuery.isFetching && <span>{t('loadingActivity')}</span>}
          </div>

          <div className="space-y-2">
            {entries.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
