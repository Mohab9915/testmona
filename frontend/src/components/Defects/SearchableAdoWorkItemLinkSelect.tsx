import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { defectManagementAPI, IssueTrackerIntegration } from '@/lib/defectManagementAPI';

type SearchableAdoWorkItemLinkSelectProps = {
  id: string;
  projectId: number;
  /** The stored value - a full ADO work item URL, or '' when nothing is linked. */
  value: string;
  onChange: (url: string) => void;
  /** Work item type names to search within (e.g. just the project's configured bug type). */
  workItemTypes: string[];
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
};

type AdoWorkItemOption = { id: string; title: string; work_item_type: string; state: string; url: string };

const SEARCH_DEBOUNCE_MS = 350;
const WORK_ITEM_ID_RE = /_workitems\/edit\/(\d+)/;

/**
 * Same remote-search pattern as SearchableAdoParentSelect, but for the
 * "Defect Link"/"Custom Link" fields on a test result: instead of storing a
 * separate id+title, it stores the picked work item's URL directly (the
 * shape those columns already have), and re-derives a display id from that
 * URL when re-opening a result that was saved in an earlier session.
 */
export function SearchableAdoWorkItemLinkSelect({
  id,
  projectId,
  value,
  onChange,
  workItemTypes,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  className = '',
}: SearchableAdoWorkItemLinkSelectProps) {
  const { t, isRTL } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdoWorkItemOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [integration, setIntegration] = useState<IssueTrackerIntegration | null>(null);
  const [integrationLoaded, setIntegrationLoaded] = useState(false);
  // Only known once the user actually picks a result this session - a value
  // loaded from a saved execution has no title attached to it, just a URL.
  const [pickedTitle, setPickedTitle] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    defectManagementAPI
      .getIssueTrackerIntegrations(projectId)
      .then((integrations) => {
        if (cancelled) return;
        const active = integrations.find((i) => i.tracker_type === 'azure-devops' && i.is_active);
        setIntegration(active || null);
      })
      .catch(() => {
        if (!cancelled) setIntegration(null);
      })
      .finally(() => {
        if (!cancelled) setIntegrationLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen || !integration || workItemTypes.length === 0) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await defectManagementAPI.searchIntegrationWorkItems(
          projectId,
          integration.id,
          trimmed,
          workItemTypes,
        );
        setResults(data.success ? (data.work_items as AdoWorkItemOption[]) : []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, integration, projectId, workItemTypes]);

  const selectValue = (item: AdoWorkItemOption | null) => {
    onChange(item?.url || '');
    setPickedTitle(item?.title || null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const matchedId = value ? value.match(WORK_ITEM_ID_RE)?.[1] : null;
  const displayValue = value
    ? (matchedId ? `#${matchedId}${pickedTitle ? ` · ${pickedTitle}` : ''}` : value)
    : emptyLabel;

  if (integrationLoaded && !integration) {
    return <p className={cn('text-xs text-muted-foreground', className)}>{t('configureAdoToLinkParent')}</p>;
  }

  if (integrationLoaded && integration && workItemTypes.length === 0) {
    return <p className={cn('text-xs text-muted-foreground', className)}>{t('noOtherAdoWorkItemTypes')}</p>;
  }

  return (
    <div ref={rootRef} className={cn('relative', className)} dir={isRTL ? 'rtl' : 'ltr'}>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled || !integration}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
      >
        <span className="min-w-0 truncate text-left rtl:text-right">{displayValue}</span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              selectValue(null);
            }}
            className="shrink-0 rounded p-0.5 hover:bg-muted"
            aria-label={t('clearSelection')}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </Button>

      {isOpen && integration && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b p-2 dark:border-gray-700">
            <div className="relative">
              <Search className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className={cn('h-9', isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8')}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setIsOpen(false);
                  }
                }}
              />
            </div>
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : !query.trim() ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">{searchPlaceholder}</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">{t('noAdoWorkItemsFound')}</div>
            ) : (
              results.map((item) => {
                const isSelected = matchedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectValue(item)}
                    className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-gray-100 rtl:text-right dark:hover:bg-gray-800"
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="text-[11px]">#{item.id}</Badge>
                        <Badge variant="secondary" className="text-[11px]">{item.work_item_type}</Badge>
                        {item.state && <Badge variant="outline" className="text-[11px]">{item.state}</Badge>}
                      </span>
                    </span>
                    {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
