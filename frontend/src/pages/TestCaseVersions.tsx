import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VersionManager } from '@/components/versioning/VersionManager';
import { getApiErrorMessage } from '@/lib/api';
import { useResolvedEntityId } from '@/hooks/useResolvedEntityId';
import { useTranslation } from '@/hooks/useTranslation';
import { useTestCaseSummary } from '@/hooks/queries/testCaseVersions';

const parsePositiveId = (value?: string): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export function TestCaseVersions() {
  const { id, projectId } = useParams<{ id: string; projectId?: string }>();
  const navigate = useNavigate();
  const { t, isRTL } = useTranslation();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // The URL carries the per-project sequence; resolve it to the global id the
  // versioning API is keyed on.
  const { id: testCaseId, loading: testCaseIdLoading } = useResolvedEntityId(
    projectId,
    'test-cases',
    id,
  );
  const routeProjectId = useMemo(() => parsePositiveId(projectId), [projectId]);

  const testCaseQuery = useTestCaseSummary(testCaseId, !testCaseIdLoading && !!testCaseId);
  const testCase = testCaseQuery.data ?? null;

  // A test case whose suite belongs to another project must not surface here.
  const projectMismatch = Boolean(
    routeProjectId &&
      testCase?.test_suite?.project_id &&
      Number(testCase.test_suite.project_id) !== routeProjectId,
  );

  const loading = testCaseIdLoading || (!!testCaseId && testCaseQuery.isLoading);
  const error: string | null =
    !testCaseIdLoading && !testCaseId
      ? t('invalidTestCaseId')
      : projectMismatch
        ? t('invalidProjectId')
        : testCaseQuery.isError
          ? getApiErrorMessage(testCaseQuery.error, t('failedToLoadTestCase'))
          : null;

  const handleBack = () => {
    const targetTestCaseId = testCase?.project_seq ?? testCaseId ?? id;
    const targetProjectId = routeProjectId ?? testCase?.test_suite?.project_id;
    if (targetProjectId) {
      navigate(`/projects/${targetProjectId}/test-cases/${targetTestCaseId}`);
    } else {
      navigate(`/test-cases/${targetTestCaseId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="w-fit gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <BackIcon className="h-4 w-4" />
              {t('backToTestCase')}
            </Button>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <BackIcon className="h-4 w-4" />
            {t('backToTestCase')}
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <History className="h-5 w-5" />
              {t('versionManagement')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('versionManagementIntro')}
            </p>
          </div>
        </div>
      </div>

      <VersionManager
        testCaseId={testCaseId}
        testCaseTitle={testCase?.title ?? t('loading')}
        enabled={!!testCaseId && !projectMismatch}
      />
    </div>
  );
}
