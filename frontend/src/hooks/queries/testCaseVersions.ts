import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testCasesAPI } from '@/lib/api';
import { versioningApi } from '@/api/versioning';
import type {
  TestCaseVersion,
  VersionComparisonResponse,
  VersionStatsResponse,
} from '@/types/versioning';

export const testCaseVersionKeys = {
  // Prefix key — invalidating this refreshes both the list and the stats.
  root: (testCaseId: number | null) => ['testCaseVersions', testCaseId] as const,
  list: (testCaseId: number | null) => ['testCaseVersions', testCaseId, 'list'] as const,
  stats: (testCaseId: number | null) => ['testCaseVersions', testCaseId, 'stats'] as const,
};

export function useTestCaseVersions(testCaseId: number | null, enabled: boolean) {
  return useQuery<TestCaseVersion[]>({
    queryKey: testCaseVersionKeys.list(testCaseId),
    queryFn: () => versioningApi.getVersions(testCaseId as number),
    enabled,
  });
}

export function useTestCaseVersionStats(testCaseId: number | null, enabled: boolean) {
  return useQuery<VersionStatsResponse>({
    queryKey: testCaseVersionKeys.stats(testCaseId),
    queryFn: () => versioningApi.getVersionStats(testCaseId as number),
    enabled,
  });
}

interface CreateVersionInput {
  version_name?: string;
  change_summary?: string;
  change_reason?: string;
}

export function useCreateTestCaseVersion(testCaseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVersionInput) =>
      versioningApi.createVersion(testCaseId as number, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: testCaseVersionKeys.root(testCaseId) }),
  });
}

// A rollback republishes the target snapshot onto the test case itself, so the
// test case's own cached queries go stale alongside the version list.
export function useRollbackTestCaseVersion(testCaseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetVersionId, reason }: { targetVersionId: number; reason: string }) =>
      versioningApi.rollbackToVersion(testCaseId as number, targetVersionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testCaseVersionKeys.root(testCaseId) });
      queryClient.invalidateQueries({ queryKey: ['testCaseSummary', testCaseId] });
      queryClient.invalidateQueries({ queryKey: ['testCaseRevisions', testCaseId] });
    },
  });
}

export function useCreateVersionBranch(testCaseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      parentVersionId,
      branchName,
      reason,
    }: {
      parentVersionId: number;
      branchName: string;
      reason: string;
    }) => versioningApi.createBranch(parentVersionId, branchName, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: testCaseVersionKeys.root(testCaseId) }),
  });
}

export function useApproveTestCaseVersion(testCaseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, comments }: { versionId: number; comments?: string }) =>
      versioningApi.approveVersion(versionId, comments),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: testCaseVersionKeys.root(testCaseId) }),
  });
}

// Publishing writes the version back onto the test case, so the test case's own
// cached queries have to be invalidated too, not just the version list.
export function usePublishTestCaseVersion(testCaseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => versioningApi.publishVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testCaseVersionKeys.root(testCaseId) });
      queryClient.invalidateQueries({ queryKey: ['testCaseSummary', testCaseId] });
      queryClient.invalidateQueries({ queryKey: ['testCaseRevisions', testCaseId] });
    },
  });
}

// Comparison is a POST that persists a `version_comparisons` row, so it is a
// mutation rather than a query — the result is held in component state.
export function useCompareTestCaseVersions() {
  return useMutation<VersionComparisonResponse, unknown, { fromVersionId: number; toVersionId: number }>({
    mutationFn: ({ fromVersionId, toVersionId }) =>
      versioningApi.compareVersions(fromVersionId, toVersionId),
  });
}

interface TestCaseSummary {
  id: number;
  title: string;
  project_seq?: number;
  test_suite?: { id: number; project_id: number };
}

// The versions page needs the test case itself for its title and for the
// project-ownership guard, independent of the version list.
export function useTestCaseSummary(testCaseId: number | null, enabled: boolean) {
  return useQuery<TestCaseSummary>({
    queryKey: ['testCaseSummary', testCaseId],
    queryFn: () => testCasesAPI.getById(testCaseId as number),
    enabled,
  });
}
