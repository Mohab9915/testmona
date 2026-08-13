import { useQuery } from '@tanstack/react-query';
import { testCasesAPI } from '@/lib/api';
import type { TestCase } from '@/types';

export const testCasesPageKeys = {
  list: (projectId: number | null, sortField: string, sortDirection: string) =>
    ['testCasesPage', 'list', projectId, sortField, sortDirection] as const,
};

const PAGE_SIZE = 500;

// All test cases for the project (selection/filtering is applied client-side)
// plus the total count, fetched together. Pages through the backend since a
// single request is capped, so no test case is silently dropped from the list.
export function useProjectTestCases(
  projectId: number | null,
  sortField: string,
  sortDirection: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: testCasesPageKeys.list(projectId, sortField, sortDirection),
    queryFn: async () => {
      const countResponse = await testCasesAPI.getCount(projectId as number);
      const count = countResponse.count as number;
      const testCases: TestCase[] = [];
      for (let skip = 0; skip < count; skip += PAGE_SIZE) {
        const page = await testCasesAPI.getAll(
          projectId as number,
          undefined,
          undefined,
          sortField,
          sortDirection,
          skip,
          PAGE_SIZE,
        );
        if (Array.isArray(page)) testCases.push(...page);
      }
      return { testCases, count };
    },
    enabled,
  });
}
