import type {
  DuplicateDecision,
  ImportJobStatus,
  ImportLogLevel,
  ImportRecordStatus,
  ImportTriggerType,
  RejectReason,
} from './statuses';
import type { ImportSourceConfig } from './source-config';
import type { ValidationIssue } from '@/features/import/validation/validation-codes';
import type { PaginatedResult } from '@/data/types/records';

export interface ImportSource {
  id: string;
  name: string;
  type: string;
  website?: string;
  sourceUrl?: string;
  sourceConfig?: ImportSourceConfig;
  defaultTimezone?: string;
  trustScore: number;
  active: boolean;
  adapterKey?: string;
  reviewRequired?: boolean;
  lastImportAt?: string;
  lastJobStatus?: ImportJobStatus;
  nextScheduledAt?: string;
}

export interface ImportJobMetrics {
  fetchedCount: number;
  parsedCount: number;
  invalidCount: number;
  warningCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
}

export interface ImportJob {
  id: string;
  sourceId: string;
  status: ImportJobStatus;
  triggerType: ImportTriggerType;
  triggeredBy?: string;
  startedAt?: string;
  finishedAt?: string;
  errorSummary?: string;
  metrics: ImportJobMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewerEdits {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  artistNames?: string[];
  genreNames?: string[];
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  organizerName?: string;
  minimumAge?: number;
  matchedCityId?: string;
  matchedVenueId?: string;
  matchedArtistIds?: string[];
  matchedGenreIds?: string[];
}

export interface ImportRecord {
  id: string;
  importJobId: string;
  sourceId: string;
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  validationErrors?: ValidationIssue[];
  validationWarnings?: ValidationIssue[];
  matchedCityId?: string;
  matchedVenueId?: string;
  matchedArtistIds?: string[];
  matchedGenreIds?: string[];
  duplicateEventId?: string;
  duplicateScore?: number;
  matchingWarnings?: string[];
  status: ImportRecordStatus;
  resultingEventId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: RejectReason;
  rejectNote?: string;
  reviewerEdits?: ReviewerEdits;
  duplicateDecision?: DuplicateDecision;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecordSummary {
  id: string;
  importJobId: string;
  sourceId: string;
  externalId: string;
  title?: string;
  eventDate?: string;
  venueName?: string;
  cityName?: string;
  sourceName?: string;
  matchConfidence?: number;
  duplicateScore?: number;
  warningCount: number;
  status: ImportRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ImportLog {
  id: string;
  importJobId: string;
  importRecordId?: string;
  level: ImportLogLevel;
  code: string;
  message: string;
  createdAt: string;
}

export interface ImportAuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface ImportMonitoringStats {
  activeSources: number;
  failedJobsLast24h: number;
  recordsInReview: number;
  invalidRecords: number;
  duplicateCandidates: number;
  averageJobDurationMs: number;
  lastSuccessfulImports: Array<{
    sourceId: string;
    sourceName: string;
    finishedAt: string;
    jobId: string;
  }>;
}

export interface CreateImportJobInput {
  sourceId: string;
  triggerType: ImportTriggerType;
  status?: ImportJobStatus;
  triggeredBy?: string;
}

export interface CreateImportRecordInput {
  importJobId: string;
  sourceId: string;
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  validationErrors?: ValidationIssue[];
  validationWarnings?: ValidationIssue[];
  matchedCityId?: string;
  matchedVenueId?: string;
  matchedArtistIds?: string[];
  matchedGenreIds?: string[];
  duplicateEventId?: string;
  duplicateScore?: number;
  matchingWarnings?: string[];
  status?: ImportRecordStatus;
}

export interface CreateImportLogInput {
  importJobId: string;
  importRecordId?: string;
  level: ImportLogLevel;
  code: string;
  message: string;
}

export interface CreateImportAuditLogInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
}

export interface ImportJobListParams {
  sourceId?: string;
  status?: ImportJobStatus | 'all';
  triggerType?: ImportTriggerType | 'all';
  fromDate?: string;
  toDate?: string;
  errorsOnly?: boolean;
  sortBy?: 'newest' | 'oldest' | 'duration' | 'errors';
  page?: number;
  pageSize?: number;
}

export interface ImportLogListParams {
  importJobId: string;
  level?: ImportLogLevel | 'all';
  code?: string;
  importRecordId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ImportRecordListParams {
  importJobId?: string;
  sourceId?: string;
  cityName?: string;
  status?: ImportRecordStatus | ImportRecordStatus[] | 'all';
  fromDate?: string;
  toDate?: string;
  minDuplicateScore?: number;
  maxDuplicateScore?: number;
  minMatchConfidence?: number;
  withWarnings?: boolean;
  withoutVenueMatch?: boolean;
  withoutCityMatch?: boolean;
  withoutGenreMatch?: boolean;
  withoutArtistMatch?: boolean;
  sortBy?: 'newest' | 'eventDate' | 'duplicateScore' | 'matchConfidence' | 'warnings';
  page?: number;
  pageSize?: number;
  includeRawPayload?: boolean;
}

export interface SourceTestResult {
  success: boolean;
  status: 'success' | 'warning' | 'failed';
  durationMs: number;
  recordCount: number;
  warnings: string[];
  errors: string[];
  sampleRecords: Array<{
    externalId: string;
    title?: string;
    startDate?: string;
    validationErrorCount: number;
    validationWarningCount: number;
  }>;
}

export type ImportJobListResult = PaginatedResult<ImportJob>;
export type ImportLogListResult = PaginatedResult<ImportLog>;
export type ImportRecordListResult = PaginatedResult<ImportRecord | ImportRecordSummary>;

export function createEmptyJobMetrics(): ImportJobMetrics {
  return {
    fetchedCount: 0,
    parsedCount: 0,
    invalidCount: 0,
    warningCount: 0,
    errorCount: 0,
    createdCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
  };
}
