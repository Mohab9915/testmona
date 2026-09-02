import { useEffect, useState } from 'react';
import { defectManagementAPI } from '@/lib/defectManagementAPI';

interface AdoWorkItemTypeSplit {
  /** The project's configured "this is a defect" type (falls back to 'Bug', matching the backend default). */
  bugTypes: string[];
  /** Every other work item type the ADO project has, for "reference something that isn't the defect itself". */
  otherTypes: string[];
}

/**
 * Splits a project's Azure DevOps work item types into "the type used for
 * defects" vs. "everything else", using the same sync_config.work_item_type
 * setting the integration already relies on to create defects - not a
 * name guess (e.g. matching "Bug"/"Issue"), since that setting is already
 * the app's own definition of "what counts as a defect" for this project.
 */
export function useAdoWorkItemTypeSplit(projectId: number): AdoWorkItemTypeSplit {
  const [split, setSplit] = useState<AdoWorkItemTypeSplit>({ bugTypes: [], otherTypes: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const integrations = await defectManagementAPI.getIssueTrackerIntegrations(projectId);
        const integration = integrations.find((i) => i.tracker_type === 'azure-devops' && i.is_active);
        if (!integration) {
          if (!cancelled) setSplit({ bugTypes: ['Bug'], otherTypes: [] });
          return;
        }
        const bugType: string = integration.sync_config?.work_item_type || 'Bug';
        const typesResult = await defectManagementAPI.getIntegrationWorkItemTypes(projectId, integration.id);
        const allTypeNames = typesResult.success ? typesResult.work_item_types.map((t) => t.name) : [];
        const otherTypes = allTypeNames.filter((name) => name !== bugType);
        if (!cancelled) setSplit({ bugTypes: [bugType], otherTypes });
      } catch {
        if (!cancelled) setSplit({ bugTypes: ['Bug'], otherTypes: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return split;
}
