import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';

/**
 * Small inline status pill for a form using useAutoSave - replaces a Save
 * button. 'idle'/'pending' render nothing (nothing has changed yet, or the
 * debounce hasn't fired), so the indicator only appears once there's
 * something to actually report.
 */
export function AutoSaveIndicator({
  status,
  error,
  onRetry,
  className = '',
}: {
  status: AutoSaveStatus;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  if (status === 'idle' || status === 'pending') return null;

  if (status === 'saving') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-slate-400 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('saving')}
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 ${className}`} title={error || undefined}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {t('autoSaveFailed')}
        {onRetry && (
          <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:no-underline">
            {t('autoSaveRetry')}
          </button>
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 ${className}`}>
      <Check className="h-3.5 w-3.5" />
      {t('savedLabel')}
    </span>
  );
}
