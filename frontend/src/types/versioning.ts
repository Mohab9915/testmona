export interface TestCaseVersion {
  id: number;
  test_case_id: number;
  version_major: number;
  version_minor: number;
  version_patch: number;
  version_label?: string;
  version_string: string;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
  version_name?: string;
  description?: string;
  change_summary?: string;
  change_reason?: string;
  branch_name?: string;
  is_merged: boolean;
  merged_into_version_id?: number;
  created_at: string;
  created_by: number;
  creator?: {
    id: number;
    username: string;
    full_name: string;
  };
  is_current_version: boolean;
  tags?: VersionTag[];
  // Test case data snapshot
  title: string;
  test_type?: string;
  preconditions?: string;
  steps?: string;
  expected_result?: string;
  priority?: string;
  tags_string?: string; // Original tags as string
  custom_fields_data?: Record<string, any>;
}

export interface VersionTag {
  id: number;
  version_id: number;
  tag_name: string;
  tag_type: string;
  description?: string;
  color: string;
  created_by: number;
  created_at: string;
}

export interface VersionComparisonResponse {
  id: number;
  from_version_id: number;
  to_version_id: number;
  field_differences: Record<string, {
    from: any;
    to: any;
    diff?: string;
  }>;
  added_fields: Record<string, any>;
  removed_fields: Record<string, any>;
  modified_fields: Record<string, {
    from: any;
    to: any;
  }>;
  similarity_score: number;
  created_at: string;
}

export interface VersionHistoryResponse {
  test_case_id: number;
  current_version?: TestCaseVersion;
  versions: TestCaseVersion[];
  total_versions: number;
  draft_versions: TestCaseVersion[];
  published_versions: TestCaseVersion[];
  branches: TestCaseVersion[];
  tags: VersionTag[];
}

export interface VersionStatsResponse {
  test_case_id: number;
  total_versions: number;
  published_versions: number;
  draft_versions: number;
  branches: number;
  tags: number;
  last_updated?: string;
  current_version?: string;
}
