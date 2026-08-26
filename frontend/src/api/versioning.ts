import { api } from '@/lib/api';
import { TestCaseVersion, VersionComparisonResponse, VersionStatsResponse } from '../types/versioning';

// Routed through the shared axios client (`@/lib/api`) so every request carries
// the Bearer token and benefits from the 401-refresh / error handling used by
// the rest of the app. The backend versioning router is mounted at `/versioning`
// (no `/api` prefix), matching the axios baseURL.
//
// Every method below maps to a route that exists in `app/api/versioning_simple.py`.
// The service layer (`app/services/versioning_service.py`) also implements merge,
// lock/unlock and tagging, but those have no HTTP routes yet — do not add client
// methods for them until the corresponding endpoints are registered.
const API_BASE = '/versioning';

interface CreateVersionPayload {
  version_name?: string;
  change_summary?: string;
  change_reason?: string;
}

export const versioningApi = {
  async createVersion(
    testCaseId: number,
    versionData: CreateVersionPayload,
  ): Promise<TestCaseVersion> {
    const response = await api.post(`${API_BASE}/test-cases/${testCaseId}/versions`, versionData);
    return response.data;
  },

  async getVersions(testCaseId: number): Promise<TestCaseVersion[]> {
    const response = await api.get(`${API_BASE}/test-cases/${testCaseId}/versions`);
    return response.data;
  },

  async getLatestVersion(testCaseId: number): Promise<TestCaseVersion | null> {
    const response = await api.get(`${API_BASE}/test-cases/${testCaseId}/versions/latest`);
    return response.data; // Returns null if no version exists
  },

  async compareVersions(
    fromVersionId: number,
    toVersionId: number,
  ): Promise<VersionComparisonResponse> {
    const response = await api.post(`${API_BASE}/versions/compare`, {
      from_version_id: fromVersionId,
      to_version_id: toVersionId,
    });
    return response.data;
  },

  async createBranch(
    parentVersionId: number,
    branchName: string,
    reason: string,
  ): Promise<TestCaseVersion> {
    const response = await api.post(`${API_BASE}/versions/branch`, {
      parent_version_id: parentVersionId,
      branch_name: branchName,
      reason,
    });
    return response.data;
  },

  async rollbackToVersion(
    testCaseId: number,
    targetVersionId: number,
    reason: string,
  ): Promise<TestCaseVersion> {
    const response = await api.post(`${API_BASE}/test-cases/${testCaseId}/rollback`, {
      target_version_id: targetVersionId,
      reason,
    });
    return response.data;
  },

  // A version is created as DRAFT. It must be approved before it can be
  // published, and publishing is what writes it back onto the test case and
  // lets the next created version increment its patch number.
  async approveVersion(versionId: number, comments?: string): Promise<TestCaseVersion> {
    const response = await api.post(`${API_BASE}/versions/${versionId}/approve`, { comments });
    return response.data;
  },

  async publishVersion(versionId: number): Promise<TestCaseVersion> {
    const response = await api.post(`${API_BASE}/versions/${versionId}/publish`);
    return response.data;
  },

  async getVersionStats(testCaseId: number): Promise<VersionStatsResponse> {
    const response = await api.get(`${API_BASE}/test-cases/${testCaseId}/stats`);
    return response.data;
  },
};
