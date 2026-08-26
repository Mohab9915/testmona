import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  GitCompare,
  ArrowLeftRight,
  Plus,
  Minus,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import { useDateFormat } from '@/hooks/useDateFormat';
import { useTranslation } from '@/hooks/useTranslation';
import { getApiErrorMessage } from '@/lib/api';
import { TestCaseVersion, VersionComparisonResponse } from '../../types/versioning';

interface VersionComparisonProps {
  fromVersion: TestCaseVersion;
  toVersion: TestCaseVersion;
  comparison?: VersionComparisonResponse | null;
  onBack?: () => void;
  onRefresh?: () => Promise<void> | void;
}

// Maps the snapshot columns on `test_case_versions` to translation keys already
// used by the revision-history page, so both views label fields identically.
const fieldLabelKeys: Record<string, string> = {
  title: 'fieldTitle',
  test_type: 'fieldTestType',
  preconditions: 'fieldPreconditions',
  steps: 'fieldSteps',
  expected_result: 'fieldExpectedResult',
  priority: 'fieldPriority',
  tags: 'tags',
};

export const VersionComparison: React.FC<VersionComparisonProps> = ({
  fromVersion,
  toVersion,
  comparison,
  onBack,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { formatRelative } = useDateFormat();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  const handleRefreshComparison = async () => {
    if (!onRefresh) return;
    try {
      setLoading(true);
      setError(null);
      await onRefresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('compareFailed')));
    } finally {
      setLoading(false);
    }
  };

  // Custom fields arrive as `custom_<name>`; standard ones map to a known label.
  const describeField = (fieldName: string) => {
    const isCustomField = fieldName.startsWith('custom_');
    const labelKey = fieldLabelKeys[fieldName];
    return {
      isCustomField,
      displayName: isCustomField
        ? fieldName.replace('custom_', '')
        : labelKey
          ? t(labelKey)
          : fieldName,
    };
  };

  const renderFieldDiff = (fieldName: string, diff: { from: any; to: any; diff?: string }) => {
    const { isCustomField, displayName } = describeField(fieldName);

    return (
      <div key={fieldName} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{displayName}</h4>
          <Badge variant="outline" className="text-xs">
            {isCustomField ? t('customField') : t('standardField')}
          </Badge>
        </div>

        {viewMode === 'side-by-side' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
                <Minus className="h-4 w-4" />
                {t('fromVersion')} ({fromVersion.version_string})
              </div>
              <div className="rounded border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                {diff.from ? (
                  <pre className="whitespace-pre-wrap text-sm">{diff.from}</pre>
                ) : (
                  <span className="italic text-slate-500 dark:text-slate-400">{t('fieldEmpty')}</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <Plus className="h-4 w-4" />
                {t('toVersion')} ({toVersion.version_string})
              </div>
              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                {diff.to ? (
                  <pre className="whitespace-pre-wrap text-sm">{diff.to}</pre>
                ) : (
                  <span className="italic text-slate-500 dark:text-slate-400">{t('fieldEmpty')}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            {diff.diff ? (
              <pre className="whitespace-pre-wrap font-mono text-sm">{diff.diff}</pre>
            ) : (
              <div className="space-y-2">
                <div className="text-rose-600 dark:text-rose-400">
                  <span className="font-medium">- </span>
                  <span>{diff.from || t('fieldEmpty')}</span>
                </div>
                <div className="text-emerald-600 dark:text-emerald-400">
                  <span className="font-medium">+ </span>
                  <span>{diff.to || t('fieldEmpty')}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getSimilarityIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    if (score >= 70) return <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    return <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 90) return 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30';
    if (score >= 70) return 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30';
    return 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30';
  };

  if (!comparison) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-slate-500 dark:text-slate-400">
            {t('noComparisonData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const modifiedCount = Object.keys(comparison.modified_fields).length;
  const addedCount = Object.keys(comparison.added_fields).length;
  const removedCount = Object.keys(comparison.removed_fields).length;

  const renderVersionSummary = (
    version: TestCaseVersion,
    tone: 'from' | 'to',
  ) => {
    const isFrom = tone === 'from';
    return (
      <div className="space-y-3">
        <h3
          className={`font-medium ${
            isFrom
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {isFrom ? t('fromVersion') : t('toVersion')}
        </h3>
        <div
          className={`rounded-lg border p-4 ${
            isFrom
              ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">{version.version_string}</span>
            <Badge variant="outline">{version.status}</Badge>
          </div>
          <div className="space-y-1 text-sm">
            <div>{version.title}</div>
            <div className="text-slate-600 dark:text-slate-400">
              {formatRelative(version.created_at)} ·{' '}
              {version.creator?.full_name || version.creator?.username}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              {t('versionComparison')}
            </CardTitle>
            <div className="flex gap-2">
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  <ArrowLeftRight className="me-2 h-4 w-4" />
                  {t('backToHistory')}
                </Button>
              )}
              {onRefresh && (
                <Button variant="outline" onClick={handleRefreshComparison} disabled={loading}>
                  {loading ? t('refreshing') : t('refresh')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {renderVersionSummary(fromVersion, 'from')}
            {renderVersionSummary(toVersion, 'to')}
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="font-medium">{t('similarityScore')}</h4>
                {getSimilarityIcon(comparison.similarity_score)}
              </div>
              <div
                className={`rounded-full px-3 py-1 font-medium ${getSimilarityColor(
                  comparison.similarity_score,
                )}`}
              >
                {t('percentSimilar', { score: comparison.similarity_score })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-rose-600 dark:text-rose-400">{error}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('comparisonResults')}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'side-by-side' ? 'default' : 'outline-solid'}
                size="sm"
                onClick={() => setViewMode('side-by-side')}
              >
                <Eye className="me-1 h-4 w-4" />
                {t('sideBySide')}
              </Button>
              <Button
                variant={viewMode === 'unified' ? 'default' : 'outline-solid'}
                size="sm"
                onClick={() => setViewMode('unified')}
              >
                {t('unifiedDiff')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {modifiedCount > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-medium">
                <Edit3 className="h-4 w-4" />
                {t('modifiedFields')} ({modifiedCount})
              </h3>
              <div className="space-y-3">
                {Object.entries(comparison.modified_fields).map(([fieldName, diff]) =>
                  renderFieldDiff(fieldName, diff),
                )}
              </div>
            </div>
          )}

          {addedCount > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-medium">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t('addedFields')} ({addedCount})
              </h3>
              <div className="space-y-3">
                {Object.entries(comparison.added_fields).map(([fieldName, value]) => {
                  const { displayName } = describeField(fieldName);
                  return (
                    <div
                      key={fieldName}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-medium">{displayName}</h4>
                        <Badge variant="outline" className="text-xs">
                          {t('fieldAdded')}
                        </Badge>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm">{value}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {removedCount > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-medium">
                <Minus className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                {t('removedFields')} ({removedCount})
              </h3>
              <div className="space-y-3">
                {Object.entries(comparison.removed_fields).map(([fieldName, value]) => {
                  const { displayName } = describeField(fieldName);
                  return (
                    <div
                      key={fieldName}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Minus className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        <h4 className="font-medium">{displayName}</h4>
                        <Badge variant="outline" className="text-xs">
                          {t('fieldRemoved')}
                        </Badge>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm">{value}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {modifiedCount === 0 && addedCount === 0 && removedCount === 0 && (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400">
              {t('noDifferencesFound')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
