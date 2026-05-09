import { TestCaseVersion, VersionComparisonResponse, VersionStatsResponse } from '../types/versioning';

const API_BASE = '/api/versioning';

export const versioningApi = {
  // Version CRUD operations
  async createVersion(testCaseId: number, versionData: any) {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(versionData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create version');
    }
    
    return response.json();
  },

  async getVersions(testCaseId: number): Promise<TestCaseVersion[]> {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/versions`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch versions');
    }
    
    return response.json();
  },

  async getLatestVersion(testCaseId: number): Promise<TestCaseVersion | null> {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/versions/latest`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch latest version');
    }
    
    const data = await response.json();
    return data; // Returns null if no version exists
  },

  async getVersion(versionId: number): Promise<TestCaseVersion> {
    const response = await fetch(`${API_BASE}/versions/${versionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch version');
    }
    
    return response.json();
  },

  async updateVersion(versionId: number, updateData: any): Promise<TestCaseVersion> {
    const response = await fetch(`${API_BASE}/versions/${versionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update version');
    }
    
    return response.json();
  },

  async publishVersion(versionId: number): Promise<any> {
    const response = await fetch(`${API_BASE}/versions/${versionId}/publish`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to publish version');
    }
    
    return response.json();
  },

  // Comparison operations
  async compareVersions(fromVersionId: number, toVersionId: number): Promise<VersionComparisonResponse> {
    const response = await fetch(`${API_BASE}/versions/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_version_id: fromVersionId,
        to_version_id: toVersionId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to compare versions');
    }
    
    return response.json();
  },

  // Branch operations
  async createBranch(parentVersionId: number, branchName: string, reason: string): Promise<TestCaseVersion> {
    const response = await fetch(`${API_BASE}/versions/branch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent_version_id: parentVersionId,
        branch_name: branchName,
        reason: reason,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create branch');
    }
    
    return response.json();
  },

  async mergeBranch(branchVersionId: number, targetVersionId: number, mergeReason: string): Promise<TestCaseVersion> {
    const response = await fetch(`${API_BASE}/versions/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch_version_id: branchVersionId,
        target_version_id: targetVersionId,
        merge_reason: mergeReason,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to merge branch');
    }
    
    return response.json();
  },

  // Rollback operations
  async rollbackToVersion(testCaseId: number, targetVersionId: number, reason: string): Promise<TestCaseVersion> {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_version_id: targetVersionId,
        reason: reason,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to rollback version');
    }
    
    return response.json();
  },

  // Lock operations
  async lockVersion(testCaseId: number, versionId: number | null, lockType: string, reason: string, expiresHours: number = 24): Promise<any> {
    const response = await fetch(`${API_BASE}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test_case_id: testCaseId,
        version_id: versionId,
        lock_type: lockType,
        reason: reason,
        expires_hours: expiresHours,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to lock version');
    }
    
    return response.json();
  },

  async releaseLocks(testCaseId: number, versionId?: number): Promise<void> {
    const url = versionId 
      ? `${API_BASE}/lock/${testCaseId}?version_id=${versionId}`
      : `${API_BASE}/lock/${testCaseId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to release locks');
    }
  },

  // Tag operations
  async addTag(versionId: number, tagName: string, tagType: string = 'release', description?: string, color: string = '#007bff'): Promise<any> {
    const response = await fetch(`${API_BASE}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version_id: versionId,
        tag_name: tagName,
        tag_type: tagType,
        description: description,
        color: color,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add tag');
    }
    
    return response.json();
  },

  // History and stats
  async getVersionHistory(testCaseId: number): Promise<any> {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/history`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch version history');
    }
    
    return response.json();
  },

  async getVersionStats(testCaseId: number): Promise<VersionStatsResponse> {
    const response = await fetch(`${API_BASE}/test-cases/${testCaseId}/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch version stats');
    }
    
    return response.json();
  },

  // Bulk operations
  async bulkOperation(testCaseIds: number[], operation: string, parameters: any): Promise<any> {
    const response = await fetch(`${API_BASE}/bulk-operation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        test_case_ids: testCaseIds,
        operation: operation,
        parameters: parameters,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to perform bulk operation');
    }
    
    return response.json();
  },
};
