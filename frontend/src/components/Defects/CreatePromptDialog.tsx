import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bug, Check, Copy, FolderGit2, Loader2, RefreshCw, Sparkles, TestTube2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { useDefectPromptTestCase } from '@/hooks/queries/defectDetail';
import { buildDefectPrompt, type DefectPromptMode, type PromptDefect } from '@/lib/defectPrompt';

interface CreatePromptDialogProps {
  open: boolean;
  onClose: () => void;
  defect: PromptDefect;
  linkedTestCase?: { id: number; title?: string | null; key?: string | null } | null;
}

export function CreatePromptDialog({ open, onClose, defect, linkedTestCase }: CreatePromptDialogProps) {
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<DefectPromptMode>('defect');
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  const hasTestCase = Boolean(linkedTestCase?.id);

  useEffect(() => {
    if (open) {
      setMode(hasTestCase ? 'defect_test_case' : 'defect');
      setCopied(false);
    }
    // Only re-derive the default mode when the dialog is (re)opened, not on every render.
  }, [open, hasTestCase]);

  const testCaseQuery = useDefectPromptTestCase(
    linkedTestCase?.id ?? null,
    open && mode === 'defect_test_case' && hasTestCase,
  );

  const testCaseForPrompt = useMemo(() => {
    if (!testCaseQuery.data) return null;
    return { ...testCaseQuery.data, key: linkedTestCase?.key ?? testCaseQuery.data.key };
  }, [testCaseQuery.data, linkedTestCase?.key]);

  const isTestCaseLoading = mode === 'defect_test_case' && hasTestCase && testCaseQuery.isLoading;
  const testCaseFailed = mode === 'defect_test_case' && hasTestCase && testCaseQuery.isError;

  const prompt = useMemo(
    () => buildDefectPrompt(defect, mode, mode === 'defect_test_case' ? testCaseForPrompt : null),
    [defect, mode, testCaseForPrompt],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({ title: t('copied'), description: t('createPromptCopiedDesc') });
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: t('error'), description: t('failedToCopy'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent isRTL={isRTL} className="sm:max-w-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="space-y-1 border-b bg-primary px-6 py-4 text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 text-primary-foreground">
            <Sparkles className="h-5 w-5" />
            {t('createPromptDialogTitle')}
          </DialogTitle>
          <p className="text-sm text-primary-foreground/80">{t('createPromptDialogSubtitle')}</p>
        </DialogHeader>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto px-6 py-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('createPromptContextLabel')}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ModeCard
                icon={<Bug className="h-4 w-4" />}
                title={t('createPromptModeDefectOnly')}
                description={t('createPromptModeDefectOnlyDesc')}
                active={mode === 'defect'}
                onClick={() => setMode('defect')}
              />
              <ModeCard
                icon={<TestTube2 className="h-4 w-4" />}
                title={t('createPromptModeDefectAndTestCase')}
                description={
                  hasTestCase
                    ? t('createPromptModeDefectAndTestCaseDesc')
                    : t('createPromptModeNoTestCaseLinked')
                }
                active={mode === 'defect_test_case'}
                disabled={!hasTestCase}
                onClick={() => hasTestCase && setMode('defect_test_case')}
              />
            </div>
            <div
              className="mt-2 flex cursor-not-allowed items-start gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 opacity-60 dark:border-slate-700 dark:bg-slate-900/40"
              title={t('createPromptConnectRepoHint')}
            >
              <FolderGit2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {t('createPromptConnectRepo')}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {t('createPromptSoon')}
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('createPromptConnectRepoHint')}</p>
              </div>
            </div>
          </div>

          {testCaseFailed && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('createPromptTestCaseLoadFailed')}</p>
                <p className="text-xs opacity-90">
                  {getApiErrorMessage(testCaseQuery.error, t('createPromptTestCaseLoadFailedDesc'))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
                onClick={() => testCaseQuery.refetch()}
              >
                <RefreshCw className="h-3 w-3" />
                {t('retry')}
              </Button>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('createPromptPreviewLabel')}
              </p>
              {isTestCaseLoading && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('loading')}
                </span>
              )}
            </div>
            <pre
              dir="ltr"
              className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-4 text-start font-mono text-xs leading-5 text-slate-100"
            >
              {prompt}
            </pre>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-gray-50 px-6 py-4 dark:bg-gray-900/50">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleCopy} disabled={isTestCaseLoading}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? t('copied') : t('createPromptCopyButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  icon,
  title,
  description,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/40'
          : active
            ? 'border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/10'
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold',
          active ? 'text-primary' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {icon}
        {title}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
    </button>
  );
}
