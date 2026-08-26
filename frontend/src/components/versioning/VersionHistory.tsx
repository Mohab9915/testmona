import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Clock,
  GitBranch,
  Tag,
  Lock,
  Eye,
  RotateCcw,
  GitMerge,
  GitPullRequest,
  History,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  CheckCircle2,
  UploadCloud,
} from 'lucide-react';
import { useDateFormat } from '@/hooks/useDateFormat';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import {
  useTestCaseVersions,
  useRollbackTestCaseVersion,
  useCreateVersionBranch,
  useApproveTestCaseVersion,
  usePublishTestCaseVersion,
} from '@/hooks/queries/testCaseVersions';
import { TestCaseVersion } from '../../types/versioning';

interface VersionHistoryProps {
  testCaseId: number;
  enabled?: boolean;
  onVersionSelect?: (version: TestCaseVersion) => void;
  onCompareVersions?: (fromVersion: TestCaseVersion, toVersion: TestCaseVersion) => void;
}

const statusColors: Record<TestCaseVersion['status'], string> = {
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  pending_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
};

const statusIcons: Record<TestCaseVersion['status'], React.ComponentType<{ className?: string }>> = {
  draft: Clock,
  pending_review: Eye,
  approved: GitPullRequest,
  published: Tag,
  archived: Lock,
};

const statusLabelKeys: Record<TestCaseVersion['status'], string> = {
  draft: 'versionStatusDraft',
  pending_review: 'versionStatusPendingReview',
  approved: 'versionStatusApproved',
  published: 'versionStatusPublished',
  archived: 'versionStatusArchived',
};

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  testCaseId,
  enabled = true,
  onVersionSelect,
  onCompareVersions,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatRelative } = useDateFormat();

  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());
  const [selectedVersions, setSelectedVersions] = useState<TestCaseVersion[]>([]);
  const [branchSource, setBranchSource] = useState<TestCaseVersion | null>(null);
  const [branchName, setBranchName] = useState('');

  const versionsQuery = useTestCaseVersions(testCaseId, enabled && !!testCaseId);
  const rollback = useRollbackTestCaseVersion(testCaseId);
  const createBranch = useCreateVersionBranch(testCaseId);
  const approve = useApproveTestCaseVersion(testCaseId);
  const publish = usePublishTestCaseVersion(testCaseId);

  const versions = versionsQuery.data ?? [];

  const toggleVersionExpansion = (versionId: number) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId);
      else next.add(versionId);
      return next;
    });
  };

  const handleVersionCompare = (version: TestCaseVersion) => {
    if (selectedVersions.length === 0) {
      setSelectedVersions([version]);
      return;
    }
    if (selectedVersions[0].id === version.id) {
      setSelectedVersions([]);
      return;
    }
    onCompareVersions?.(selectedVersions[0], version);
    setSelectedVersions([]);
  };

  const handleRollback = async (version: TestCaseVersion) => {
    if (!window.confirm(t('confirmRollbackVersion', { version: version.version_string }))) return;

    try {
      await rollback.mutateAsync({
        targetVersionId: version.id,
        reason: t('versionRolledBack', { version: version.version_string }),
      });
      toast({
        title: t('success'),
        description: t('versionRolledBack', { version: version.version_string }),
      });
    } catch (error: unknown) {
      toast({
        title: t('error'),
        description: getApiErrorMessage(error, t('versionRollbackFailed')),
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (version: TestCaseVersion) => {
    try {
      await approve.mutateAsync({ versionId: version.id });
      toast({
        title: t('success'),
        description: t('versionApproved', { version: version.version_string }),
      });
    } catch (error: unknown) {
      toast({
        title: t('error'),
        description: getApiErrorMessage(error, t('versionApproveFailed')),
        variant: 'destructive',
      });
    }
  };

  const handlePublish = async (version: TestCaseVersion) => {
    if (!window.confirm(t('confirmPublishVersion', { version: version.version_string }))) return;
    try {
      await publish.mutateAsync(version.id);
      toast({
        title: t('success'),
        description: t('versionPublished', { version: version.version_string }),
      });
    } catch (error: unknown) {
      toast({
        title: t('error'),
        description: getApiErrorMessage(error, t('versionPublishFailed')),
        variant: 'destructive',
      });
    }
  };

  const openBranchDialog = (version: TestCaseVersion) => {
    setBranchSource(version);
    setBranchName('');
  };

  const handleCreateBranch = async () => {
    if (!branchSource) return;

    const name = branchName.trim();
    if (!name) {
      toast({ title: t('error'), description: t('branchNameRequired'), variant: 'destructive' });
      return;
    }

    try {
      await createBranch.mutateAsync({
        parentVersionId: branchSource.id,
        branchName: name,
        reason: t('branchNamePrompt', { version: branchSource.version_string }),
      });
      toast({ title: t('success'), description: t('branchCreated', { name }) });
      setBranchSource(null);
      setBranchName('');
    } catch (error: unknown) {
      toast({
        title: t('error'),
        description: getApiErrorMessage(error, t('branchCreateFailed')),
        variant: 'destructive',
      });
    }
  };

  if (versionsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            <span className="ms-2 text-slate-600 dark:text-slate-400">
              {t('loadingVersionHistory')}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (versionsQuery.isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-rose-600 dark:text-rose-400">
            {getApiErrorMessage(versionsQuery.error, t('versionsLoadFailed'))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('versionHistory')}
            <Badge variant="outline">{t('versionsCountBadge', { count: versions.length })}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedVersions.length === 1 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {t('versionSelectedHint', { version: selectedVersions[0].version_string })}
              </p>
            </div>
          )}

          {versions.length === 0 ? (
            <div className="py-8 text-center">
              <Tag className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="font-medium text-slate-700 dark:text-slate-300">{t('noVersionsFound')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {t('noVersionsYetHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const StatusIcon = statusIcons[version.status];
                const isExpanded = expandedVersions.has(version.id);
                const isSelected = selectedVersions.some((v) => v.id === version.id);

                return (
                  <div
                    key={version.id}
                    className={`rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    } ${version.is_current_version ? 'ring-2 ring-emerald-500' : ''}`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleVersionExpansion(version.id)}
                            className="h-6 w-6 p-1"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                            )}
                          </Button>

                          <div className="flex items-center gap-2">
                            {version.branch_name ? (
                              <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Tag className="h-4 w-4 text-slate-500" />
                            )}
                            <span className="font-medium">{version.version_string}</span>
                            {version.is_current_version && (
                              <Badge variant="default" className="text-xs">
                                {t('current')}
                              </Badge>
                            )}
                          </div>

                          <Badge className={statusColors[version.status]}>
                            <StatusIcon className="me-1 h-3 w-3" />
                            {t(statusLabelKeys[version.status])}
                          </Badge>

                          {version.tags && version.tags.length > 0 && (
                            <div className="flex gap-1">
                              {version.tags.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  style={{ borderColor: tag.color, color: tag.color }}
                                  className="text-xs"
                                >
                                  {tag.tag_name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.creator?.full_name || version.creator?.username}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatRelative(version.created_at)}
                          </span>
                        </div>
                      </div>

                      {version.version_name && (
                        <div className="mt-2 font-medium text-slate-900 dark:text-slate-100">
                          {version.version_name}
                        </div>
                      )}

                      {version.change_summary && (
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {version.change_summary}
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                          {version.description && (
                            <div>
                              <h5 className="mb-1 text-sm font-medium">{t('description')}</h5>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {version.description}
                              </p>
                            </div>
                          )}

                          {version.change_reason && (
                            <div>
                              <h5 className="mb-1 text-sm font-medium">{t('changeReason')}</h5>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {version.change_reason}
                              </p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-2">
                            {onVersionSelect && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onVersionSelect(version)}
                              >
                                <Eye className="me-1 h-4 w-4" />
                                {t('view')}
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVersionCompare(version)}
                              disabled={isSelected}
                            >
                              <GitMerge className="me-1 h-4 w-4" />
                              {isSelected ? t('selected') : t('compare')}
                            </Button>

                            {(version.status === 'draft' || version.status === 'pending_review') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(version)}
                                disabled={approve.isPending}
                              >
                                <CheckCircle2 className="me-1 h-4 w-4" />
                                {t('approveVersion')}
                              </Button>
                            )}

                            {version.status === 'approved' && (
                              <Button
                                size="sm"
                                onClick={() => handlePublish(version)}
                                disabled={publish.isPending}
                              >
                                <UploadCloud className="me-1 h-4 w-4" />
                                {t('publishVersion')}
                              </Button>
                            )}

                            {version.status === 'published' && !version.is_current_version && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRollback(version)}
                                disabled={rollback.isPending}
                              >
                                <RotateCcw className="me-1 h-4 w-4" />
                                {t('rollback')}
                              </Button>
                            )}

                            {!version.branch_name && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openBranchDialog(version)}
                              >
                                <GitBranch className="me-1 h-4 w-4" />
                                {t('branch')}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!branchSource} onOpenChange={(open) => !open && setBranchSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createBranch')}</DialogTitle>
            <DialogDescription>
              {branchSource
                ? t('branchNamePrompt', { version: branchSource.version_string })
                : null}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreateBranch();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchSource(null)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateBranch}
              disabled={createBranch.isPending || !branchName.trim()}
            >
              {t('createBranch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
