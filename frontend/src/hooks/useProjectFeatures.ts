import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { isFeatureEnabled, type ProjectFeatureKey, type ProjectFeatureMap } from '@/lib/projectFeatures';

/**
 * A project's feature-toggle map by id, falling back to the selected project
 * (mirrors the lookup FeatureGuard uses for full-page gating). While the
 * project hasn't loaded yet this returns undefined, which isFeatureEnabled
 * treats as "enabled" - avoiding a flash of hidden content.
 */
export function useProjectFeatureFlags(projectId: number | null | undefined): ProjectFeatureMap | null | undefined {
  const { projects, selectedProject } = useProjectStore();
  return useMemo(() => {
    if (projectId != null) {
      const found = projects.find((p) => p.id === projectId);
      if (found) return found.features;
    }
    return selectedProject?.features;
  }, [projectId, projects, selectedProject]);
}

/** Whether a project-scoped feature is on, for gating an embedded widget/section
 * (as opposed to FeatureGuard, which blocks an entire page). */
export function useIsFeatureEnabled(projectId: number | null | undefined, feature: ProjectFeatureKey): boolean {
  const features = useProjectFeatureFlags(projectId);
  return isFeatureEnabled(features, feature);
}
