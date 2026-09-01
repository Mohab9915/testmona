import { CheckCircle, XCircle, AlertTriangle, SkipForward } from 'lucide-react';
import { useExecution } from './ExecutionContext';
import type { ExecutionStatus } from './statusConfig';

interface Choice {
  value: Exclude<ExecutionStatus, 'pending'>;
  labelKey: string;
  icon: typeof CheckCircle;
  /** Classes applied when this choice is the active one. */
  active: string;
  /** Icon tint when inactive. */
  idle: string;
}

const CHOICES: Choice[] = [
  { value: 'passed', labelKey: 'passed', icon: CheckCircle, active: 'border-emerald-500 bg-emerald-500 text-white shadow-sm', idle: 'text-emerald-600' },
  { value: 'failed', labelKey: 'failed', icon: XCircle, active: 'border-red-500 bg-red-500 text-white shadow-sm', idle: 'text-red-600' },
  { value: 'blocked', labelKey: 'blocked', icon: AlertTriangle, active: 'border-amber-500 bg-amber-500 text-white shadow-sm', idle: 'text-amber-600' },
  { value: 'skipped', labelKey: 'skipped', icon: SkipForward, active: 'border-slate-500 bg-slate-500 text-white shadow-sm', idle: 'text-slate-500' },
];

const SHORTCUT: Record<string, string> = { passed: 'P', failed: 'F', blocked: 'B', skipped: 'S' };

/** Large segmented outcome control — the primary way to record a result. */
export function StatusSelector({ compact = false }: { compact?: boolean }) {
  const { t, executionStatus, setExecutionStatus, hasIterations, canWrite, hasFailedOrBlockedStep, stepsIncomplete } = useExecution();

  if (hasIterations) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        {t('statusDerivedFromIterations')}
      </p>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${compact ? '' : 'sm:gap-3'}`}>
      {CHOICES.map((choice) => {
        const isActive = executionStatus === choice.value;
        const Icon = choice.icon;
        // A failed/blocked step makes "the case passed" or "skip it" a
        // contradiction - only failed/blocked stay pickable until that
        // step's outcome changes. "Passed" additionally claims every step
        // was actually run, so it also waits on stepsIncomplete - Skipped
        // doesn't, since skipping is legitimate without running anything.
        const blockedByStep = hasFailedOrBlockedStep && (choice.value === 'passed' || choice.value === 'skipped');
        const blockedByIncompleteSteps = choice.value === 'passed' && stepsIncomplete;
        const disabled = !canWrite || blockedByStep || blockedByIncompleteSteps;
        const disabledReason = blockedByStep
          ? t('resultContradictsFailedStep')
          : blockedByIncompleteSteps
            ? t('resultRequiresAllStepsRun')
            : null;
        return (
          <button
            key={choice.value}
            type="button"
            disabled={disabled}
            onClick={() => setExecutionStatus(choice.value)}
            aria-pressed={isActive}
            title={disabledReason || `${t(choice.labelKey)} (${SHORTCUT[choice.value]})`}
            className={`group flex items-center justify-center gap-2 rounded-lg border font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              compact ? 'h-9 px-2 text-xs' : 'h-14 text-sm'
            } ${
              isActive
                ? choice.active
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${isActive ? '' : choice.idle}`} />
            <span>{t(choice.labelKey)}</span>
            {!compact && (
              <kbd className={`ml-1 hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline ${
                isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}>
                {SHORTCUT[choice.value]}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
