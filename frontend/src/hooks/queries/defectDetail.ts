import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { defectsAPI, requirementsAPI, projectAssignmentsAPI, testResultsAPI, testCasesAPI } from '@/lib/api';

export const defectDetailKeys = {
  detail: (defectId: number | null) => ['defectDetail', defectId] as const,
  requirements: (projectId: number | null) => ['defectDetail', 'requirements', projectId] as const,
  members: (projectId: number | null) => ['defectDetail', 'members', projectId] as const,
  promptTestCase: (testCaseId: number | null) => ['defectDetail', 'promptTestCase', testCaseId] as const,
};

export function useDefectDetail(defectId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: defectDetailKeys.detail(defectId),
    queryFn: ({ signal }) => defectsAPI.getDetail(defectId as number, signal),
    enabled,
  });
}

export function useDefectEditRequirements(projectId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: defectDetailKeys.requirements(projectId),
    queryFn: async () => {
      const items = await requirementsAPI.getAll(projectId as number, 0, 500);
      return Array.isArray(items) ? items : [];
    },
    enabled,
  });
}

export function useDefectProjectMembers(projectId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: defectDetailKeys.members(projectId),
    queryFn: async () => {
      const rows = await projectAssignmentsAPI.listMembers(projectId as number);
      return (Array.isArray(rows) ? rows : []).map((m: any) => ({
        id: m.user_id,
        name: m.full_name || m.username || m.email || `User ${m.user_id}`,
      }));
    },
    enabled,
  });
}

// Full test-case fields (steps/preconditions/etc.) for the "Create Prompt" dialog.
// The defect-detail response only carries an id/key/title/status summary, so this
// is fetched separately and only when the user picks the "defect + test case" mode.
export function useDefectPromptTestCase(testCaseId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: defectDetailKeys.promptTestCase(testCaseId),
    queryFn: async () => {
      const [testCase, steps] = await Promise.all([
        testCasesAPI.getById(testCaseId as number),
        testCasesAPI.getSteps(testCaseId as number),
      ]);
      return { ...testCase, test_steps: Array.isArray(steps) ? steps : testCase?.test_steps };
    },
    enabled: enabled && testCaseId != null,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateDefect(defectId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => defectsAPI.update(defectId as number, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: defectDetailKeys.detail(defectId) }),
  });
}

export function useUpdateDefectSnapshot(defectId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testResultId, linkId, clearFailingStep }: { testResultId: number; linkId: number; clearFailingStep: boolean }) =>
      testResultsAPI.updateDefectLinkSnapshot(testResultId, linkId, { clear_failing_step: clearFailingStep }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: defectDetailKeys.detail(defectId) }),
  });
}
