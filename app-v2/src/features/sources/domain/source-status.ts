/**
 * Central source management status model (Sprint 10).
 * Distinct from connector health and registry lifecycle — this is the admin-facing source status.
 */
export const SOURCE_MANAGEMENT_STATUSES = [
  'draft',
  'active',
  'disabled',
  'archived',
  'error',
  'maintenance',
] as const;

export type SourceManagementStatus = (typeof SOURCE_MANAGEMENT_STATUSES)[number];

export function isSourceManagementStatus(value: string): value is SourceManagementStatus {
  return (SOURCE_MANAGEMENT_STATUSES as readonly string[]).includes(value);
}

export function resolveSourceManagementStatus(record: {
  status?: SourceManagementStatus;
  enabled: boolean;
  archived: boolean;
  consecutiveFailureCount?: number;
}): SourceManagementStatus {
  if (record.status && isSourceManagementStatus(record.status)) {
    return record.status;
  }
  if (record.archived) {
    return 'archived';
  }
  if ((record.consecutiveFailureCount ?? 0) >= 3) {
    return 'error';
  }
  if (record.enabled) {
    return 'active';
  }
  return 'disabled';
}

export function applySourceManagementStatus(
  status: SourceManagementStatus,
  current: { enabled: boolean; archived: boolean },
): { enabled: boolean; archived: boolean; status: SourceManagementStatus } {
  switch (status) {
    case 'draft':
      return { enabled: false, archived: false, status };
    case 'active':
      return { enabled: true, archived: false, status };
    case 'disabled':
      return { enabled: false, archived: false, status };
    case 'archived':
      return { enabled: false, archived: true, status };
    case 'error':
      return { enabled: false, archived: false, status };
    case 'maintenance':
      return { enabled: false, archived: false, status };
    default:
      return { ...current, status: resolveSourceManagementStatus({ ...current }) };
  }
}
