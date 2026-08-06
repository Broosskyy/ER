import type {
  ImportJob,
  ImportLog,
  ImportRecord,
  ImportRecordSummary,
  ImportSource,
  ReviewerEdits,
} from '@/features/import/models/types';
import { createEmptyJobMetrics } from '@/features/import/models/types';
import type { ImportSourceConfig } from '@/features/import/models/source-config';
import type { ValidationIssue } from '@/features/import/validation/validation-codes';
import type {
  DuplicateDecision,
  ImportJobStatus,
  ImportLogLevel,
  ImportRecordStatus,
  ImportTriggerType,
  RejectReason,
} from '@/features/import/models/statuses';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import type { SourceRecord } from '@/data/types/records';
import {
  mapImportSourceToSourceRecord,
  mapSourceRecordToImportSource,
  mapSourceRecordToRow,
  mapSourceRowToRecord,
  type SourceRow,
} from '@/data/mappers/source-mapper';

interface SourceRowLegacy extends SourceRow {}

export { mapSourceRecordToImportSource };

export function mapSourceRowToImportSource(row: SourceRowLegacy): ImportSource {
  return mapSourceRecordToImportSource(mapSourceRowToRecord(row));
}

export function mapImportSourceToSourceRow(source: ImportSource): Record<string, unknown> {
  return mapSourceRecordToRow(mapImportSourceToSourceRecord(source)) as unknown as Record<string, unknown>;
}

interface ImportJobRow {
  id: string;
  source_id: string;
  status: ImportJobStatus;
  trigger_type: ImportTriggerType;
  triggered_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_summary: string | null;
  fetched_count: number;
  parsed_count: number;
  invalid_count: number;
  warning_count: number;
  error_count: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  unchanged_count?: number;
  missing_count?: number;
  pages_processed?: number;
  connector_version?: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportRecordRow {
  id: string;
  import_job_id: string;
  source_id: string;
  external_id: string;
  source_url: string | null;
  source_type: string | null;
  original_url: string | null;
  retrieved_at: string | null;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown> | null;
  validation_errors: ValidationIssue[] | null;
  validation_warnings: ValidationIssue[] | null;
  matched_city_id: string | null;
  matched_venue_id: string | null;
  matched_organizer_id: string | null;
  matched_artist_ids: string[] | null;
  matched_genre_ids: string[] | null;
  duplicate_event_id: string | null;
  duplicate_score: number | null;
  matching_warnings: string[] | null;
  status: ImportRecordStatus;
  resulting_event_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: RejectReason | null;
  reject_note: string | null;
  reviewer_edits: ReviewerEdits | null;
  duplicate_decision: DuplicateDecision | null;
  created_at: string;
  updated_at: string;
}

interface ImportLogRow {
  id: string;
  import_job_id: string;
  import_record_id: string | null;
  level: ImportLogLevel;
  code: string;
  message: string;
  created_at: string;
}

export function mapImportJobRowToDomain(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    sourceId: row.source_id,
    status: row.status,
    triggerType: row.trigger_type,
    triggeredBy: row.triggered_by ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    errorSummary: row.error_summary ?? undefined,
    metrics: {
      fetchedCount: row.fetched_count ?? 0,
      parsedCount: row.parsed_count ?? 0,
      invalidCount: row.invalid_count ?? 0,
      warningCount: row.warning_count ?? 0,
      errorCount: row.error_count ?? 0,
      createdCount: row.created_count ?? 0,
      updatedCount: row.updated_count ?? 0,
      duplicateCount: row.duplicate_count ?? 0,
      unchangedCount: row.unchanged_count ?? 0,
      missingCount: row.missing_count ?? 0,
      pagesProcessed: row.pages_processed ?? 0,
      connectorVersion: row.connector_version ?? undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapImportJobToRow(job: ImportJob): Record<string, unknown> {
  return {
    id: job.id,
    source_id: job.sourceId,
    status: job.status,
    trigger_type: job.triggerType,
    triggered_by: job.triggeredBy ?? null,
    started_at: job.startedAt ?? null,
    finished_at: job.finishedAt ?? null,
    error_summary: job.errorSummary ?? null,
    fetched_count: job.metrics.fetchedCount,
    parsed_count: job.metrics.parsedCount,
    invalid_count: job.metrics.invalidCount,
    warning_count: job.metrics.warningCount,
    error_count: job.metrics.errorCount,
    created_count: job.metrics.createdCount,
    updated_count: job.metrics.updatedCount,
    duplicate_count: job.metrics.duplicateCount,
    unchanged_count: job.metrics.unchangedCount ?? 0,
    missing_count: job.metrics.missingCount ?? 0,
    pages_processed: job.metrics.pagesProcessed ?? 0,
    connector_version: job.metrics.connectorVersion ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export function mapImportRecordRowToDomain(row: ImportRecordRow): ImportRecord {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    sourceId: row.source_id,
    externalId: row.external_id,
    sourceUrl: row.source_url ?? undefined,
    sourceType: row.source_type ?? undefined,
    originalUrl: row.original_url ?? row.source_url ?? undefined,
    retrievedAt: row.retrieved_at ?? undefined,
    rawPayload: row.raw_payload,
    normalizedPayload: row.normalized_payload ?? undefined,
    validationErrors: row.validation_errors ?? undefined,
    validationWarnings: row.validation_warnings ?? undefined,
    matchedCityId: row.matched_city_id ?? undefined,
    matchedVenueId: row.matched_venue_id ?? undefined,
    matchedOrganizerId: row.matched_organizer_id ?? undefined,
    matchedArtistIds: row.matched_artist_ids ?? undefined,
    matchedGenreIds: row.matched_genre_ids ?? undefined,
    duplicateEventId: row.duplicate_event_id ?? undefined,
    duplicateScore: row.duplicate_score ?? undefined,
    matchingWarnings: row.matching_warnings ?? undefined,
    status: row.status,
    resultingEventId: row.resulting_event_id ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    rejectReason: row.reject_reason ?? undefined,
    rejectNote: row.reject_note ?? undefined,
    reviewerEdits: row.reviewer_edits ?? undefined,
    duplicateDecision: row.duplicate_decision ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapImportRecordToRow(record: ImportRecord): Record<string, unknown> {
  return {
    id: record.id,
    import_job_id: record.importJobId,
    source_id: record.sourceId,
    external_id: record.externalId,
    source_url: record.sourceUrl ?? null,
    source_type: record.sourceType ?? null,
    original_url: record.originalUrl ?? record.sourceUrl ?? null,
    retrieved_at: record.retrievedAt ?? null,
    raw_payload: record.rawPayload,
    normalized_payload: record.normalizedPayload ?? null,
    validation_errors: record.validationErrors ?? null,
    validation_warnings: record.validationWarnings ?? null,
    matched_city_id: record.matchedCityId ?? null,
    matched_venue_id: record.matchedVenueId ?? null,
    matched_organizer_id: record.matchedOrganizerId ?? null,
    matched_artist_ids: record.matchedArtistIds ?? [],
    matched_genre_ids: record.matchedGenreIds ?? [],
    duplicate_event_id: record.duplicateEventId ?? null,
    duplicate_score: record.duplicateScore ?? null,
    matching_warnings: record.matchingWarnings ?? null,
    status: record.status,
    resulting_event_id: record.resultingEventId ?? null,
    reviewed_by: record.reviewedBy ?? null,
    reviewed_at: record.reviewedAt ?? null,
    reject_reason: record.rejectReason ?? null,
    reject_note: record.rejectNote ?? null,
    reviewer_edits: record.reviewerEdits ?? null,
    duplicate_decision: record.duplicateDecision ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapImportLogRowToDomain(row: ImportLogRow): ImportLog {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    importRecordId: row.import_record_id ?? undefined,
    level: row.level,
    code: row.code,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function mapImportLogToRow(log: ImportLog): Record<string, unknown> {
  return {
    id: log.id,
    import_job_id: log.importJobId,
    import_record_id: log.importRecordId ?? null,
    level: log.level,
    code: log.code,
    message: log.message,
    created_at: log.createdAt,
  };
}

function asCandidate(payload?: Record<string, unknown>): Partial<NormalizedEventCandidate> {
  return (payload ?? {}) as Partial<NormalizedEventCandidate>;
}

export function mapImportRecordToSummary(
  record: ImportRecord,
  sourceName?: string,
): ImportRecordSummary {
  const candidate = asCandidate(record.normalizedPayload);
  const matchConfidence = computeMatchConfidence(record);
  return {
    id: record.id,
    importJobId: record.importJobId,
    sourceId: record.sourceId,
    externalId: record.externalId,
    title: candidate.title,
    eventDate: candidate.startDate,
    venueName: candidate.venueName,
    cityName: candidate.cityName,
    sourceName,
    sourceType: record.sourceType,
    originalUrl: record.originalUrl ?? record.sourceUrl,
    retrievedAt: record.retrievedAt,
    matchConfidence,
    duplicateScore: record.duplicateScore,
    warningCount: record.validationWarnings?.length ?? 0,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function computeMatchConfidence(record: ImportRecord): number {
  let score = 0;
  let factors = 0;
  if (record.matchedCityId) {
    score += 1;
    factors += 1;
  }
  if (record.matchedVenueId) {
    score += 1;
    factors += 1;
  }
  if (record.matchedArtistIds && record.matchedArtistIds.length > 0) {
    score += 1;
    factors += 1;
  }
  if (record.matchedGenreIds && record.matchedGenreIds.length > 0) {
    score += 1;
    factors += 1;
  }
  return factors > 0 ? score / factors : 0;
}

export type {
  SourceRow,
  ImportJobRow,
  ImportRecordRow,
  ImportLogRow,
};
