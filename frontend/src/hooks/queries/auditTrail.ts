import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditAPI } from '@/lib/api';
import type { AuditTrailFilters, AuditTrailList, EntityHistory } from '@/types';

export const auditKeys = {
  list: (filters: AuditTrailFilters) => ['auditTrails', filters] as const,
  entity: (entityType: string | null, entityId: number | null) =>
    ['auditTrails', 'entity', entityType, entityId] as const,
};

/**
 * Project-scoped activity feed. `placeholderData: keepPreviousData` keeps the
 * previous page on screen while the next one loads, so paging and filtering
 * don't flash an empty table.
 */
export function useAuditTrails(filters: AuditTrailFilters, enabled: boolean) {
  return useQuery<AuditTrailList>({
    queryKey: auditKeys.list(filters),
    queryFn: ({ signal }) => auditAPI.getAuditTrails(filters, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Every recorded change to one entity, for the History tab on detail pages. */
export function useEntityHistory(
  entityType: string | null,
  entityId: number | null,
  enabled: boolean,
) {
  return useQuery<EntityHistory>({
    queryKey: auditKeys.entity(entityType, entityId),
    queryFn: ({ signal }) =>
      auditAPI.getEntityHistory(entityType as string, entityId as number, signal),
    enabled: enabled && !!entityType && !!entityId,
  });
}
