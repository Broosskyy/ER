import type { AggregationPipelineStatus } from '@/features/aggregation/domain/import-pipeline-status';
import type { ImportRecordStatus } from '@/features/import/models/statuses';

const TO_IMPORT_RECORD_STATUS: Record<AggregationPipelineStatus, ImportRecordStatus> = {
  discovered: 'fetched',
  imported: 'fetched',
  normalized: 'parsed',
  validated: 'needs_review',
  duplicate: 'duplicate',
  pending_review: 'needs_review',
  approved: 'approved',
  published: 'imported',
  rejected: 'rejected',
  archived: 'rejected',
};

const FROM_IMPORT_RECORD_STATUS: Partial<Record<ImportRecordStatus, AggregationPipelineStatus>> = {
  fetched: 'imported',
  parsed: 'normalized',
  needs_review: 'pending_review',
  invalid: 'rejected',
  duplicate: 'duplicate',
  approved: 'approved',
  rejected: 'rejected',
  imported: 'published',
};

export function mapPipelineStatusToImportRecordStatus(
  status: AggregationPipelineStatus,
): ImportRecordStatus {
  return TO_IMPORT_RECORD_STATUS[status];
}

export function mapImportRecordStatusToPipelineStatus(
  status: ImportRecordStatus,
): AggregationPipelineStatus {
  return FROM_IMPORT_RECORD_STATUS[status] ?? 'pending_review';
}
