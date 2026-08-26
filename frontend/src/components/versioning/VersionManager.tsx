import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { VersionHistory } from './VersionHistory';
import { VersionComparison } from './VersionComparison';
import { History, GitCompare, Plus, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { useDateFormat } from '@/hooks/useDateFormat';
import { getApiErrorMessage } from '@/lib/api';
import {
  useCompareTestCaseVersions,
  useCreateTestCaseVersion,
  useTestCaseVersionStats,
} from '@/hooks/queries/testCaseVersions';
import { TestCaseVersion, VersionComparisonResponse } from '../../types/versioning';

interface VersionManagerProps {
  testCaseId: number;
  testCaseTitle: string;
  enabled?: boolean;
  onVersionCreated?: () => void;
}

export const VersionManager: React.FC<VersionManagerProps> = ({
  testCaseId,
  testCaseTitle,
  enabled = true,
  onVersionCreated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatDateTime } = useDateFormat();

  const [activeTab, setActiveTab] = useState('history');
  const [selectedVersions, setSelectedVersions] = useState<
    [TestCaseVersion | null, TestCaseVersion | null]
  >([null, null]);
  const [comparison, setComparison] = useState<VersionComparisonResponse | null>(null);

  const createVersion = useCreateTestCaseVersion(testCaseId);
  const compareVersions = useCompareTestCaseVersions();

  const handleCompareVersions = async (
    fromVersion: TestCaseVersion,
    toVersion: TestCaseVersion,
  ) => {
    try {
      const comparisonData = await compareVersions.mutateAsync({
        fromVersionId: fromVersion.id,
        toVersionId: toVersion.id,
      });
      setComparison(comparisonData);
      setSelectedVersions([fromVersion, toVersion]);
      setActiveTab('comparison');
    } catch (error: unknown) {
      toast({
        title: t('error'),
        description: getApiErrorMessage(error, t('compareFailed')),
        variant: 'destructive',
      });
    }
  };

  const handleCreateNewVersion = async () => {
    try {
      await createVersion.mutateAsync({
        version_name: t('versionDefaultName', {
          date: formatDateTime(new Date().toISOString()) || '',
        }),
        change_summary: t('versionDefaultSummary'),
        change_reason: t('versionDefaultReason'),
      });
      toast({ title: t('success'), description: t('versionCreated') });
      onVersionCreated?.();
      setActiveTab('history');
    } catch (error: unknown) {
      toast({
        title: t('error'),
        description: getApiErrorMessage(error, t('versionCreateFailed')),
        variant: 'destructive',
      });
    }
  };

  const handleRefreshComparison = async () => {
    if (!selectedVersions[0] || !selectedVersions[1]) return;
    await handleCompareVersions(selectedVersions[0], selectedVersions[1]);
  };

  const handleBackToHistory = () => {
    setActiveTab('history');
    setSelectedVersions([null, null]);
    setComparison(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('versionManagement')}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t('versionManagementFor', { title: testCaseTitle })}
              </p>
            </div>
            <Button onClick={handleCreateNewVersion} disabled={createVersion.isPending}>
              <Plus className="me-2 h-4 w-4" />
              {createVersion.isPending ? t('creatingVersion') : t('createVersion')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('tabVersionHistory')}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            {t('tabVersionComparison')}
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('tabVersionOperations')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <VersionHistory
            testCaseId={testCaseId}
            enabled={enabled}
            onCompareVersions={handleCompareVersions}
          />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          {selectedVersions[0] && selectedVersions[1] ? (
            <VersionComparison
              fromVersion={selectedVersions[0]}
              toVersion={selectedVersions[1]}
              comparison={comparison}
              onBack={handleBackToHistory}
              onRefresh={handleRefreshComparison}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-slate-500 dark:text-slate-400">
                  <GitCompare className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
                  <p>{t('selectTwoVersionsToCompare')}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('history')}>
                    {t('goToVersionHistory')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('quickActions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <h4 className="mb-2 flex items-center gap-2 font-medium">
                    <Plus className="h-4 w-4" />
                    {t('createNewVersion')}
                  </h4>
                  <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                    {t('createVersionDesc')}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleCreateNewVersion}
                    disabled={createVersion.isPending}
                  >
                    {createVersion.isPending ? t('creatingVersion') : t('createNewVersion')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('versionStatistics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <VersionStats testCaseId={testCaseId} enabled={enabled} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const VersionStats: React.FC<{ testCaseId: number; enabled: boolean }> = ({
  testCaseId,
  enabled,
}) => {
  const { t } = useTranslation();
  const statsQuery = useTestCaseVersionStats(testCaseId, enabled && !!testCaseId);

  if (statsQuery.isLoading) {
    return (
      <div className="py-4 text-center text-slate-500 dark:text-slate-400">
        {t('loadingStatistics')}
      </div>
    );
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <div className="py-4 text-center text-slate-500 dark:text-slate-400">
        {t('noStatisticsAvailable')}
      </div>
    );
  }

  const stats = statsQuery.data;

  const tiles: Array<{ label: string; value: number; className: string }> = [
    {
      label: t('totalVersions'),
      value: stats.total_versions,
      className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    },
    {
      label: t('publishedVersions'),
      value: stats.published_versions,
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    },
    {
      label: t('draftVersions'),
      value: stats.draft_versions,
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    },
    {
      label: t('branchCount'),
      value: stats.branches,
      className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <div key={tile.label} className={`rounded p-3 text-center ${tile.className}`}>
            <div className="text-2xl font-bold">{tile.value}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">{tile.label}</div>
          </div>
        ))}
      </div>

      {stats.current_version && (
        <div className="rounded bg-slate-50 p-3 text-center dark:bg-slate-900/50">
          <div className="text-sm text-slate-600 dark:text-slate-400">{t('currentVersion')}</div>
          <div className="font-medium">{stats.current_version}</div>
        </div>
      )}
    </div>
  );
};
