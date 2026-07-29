import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import { ImportError } from '@/features/import/errors/import-errors';
import type { ImportPublishBatchResult } from '@/features/import/services/import-publish-orchestrator-service';
import type { ImportJob, ImportJobMetrics } from '@/features/import/models/types';
import type { SourceReputationEventType } from '../domain/trust-quality-types';

export type ImportRunFailureCategory =
  | 'platform'
  | 'source_configuration'
  | 'source_data'
  | 'unknown';

export interface ImportRunReputationSummary {
  importJobId: string;
  jobStatus: ImportJob['status'];
  metrics: ImportJobMetrics;
  publishResult?: ImportPublishBatchResult;
  failureCategory?: ImportRunFailureCategory;
  errorMessage?: string;
  fetchedCount: number;
  parsedCount: number;
  invalidCount: number;
  duplicateCount: number;
  publishedCount: number;
  queuedCount: number;
  rejectedCount: number;
  heldCount: number;
  noRecordsFound: boolean;
  parsingErrorCount: number;
  mappingErrorCount: number;
}

export interface ImportRunReputationDecision {
  eventType: SourceReputationEventType | null;
  metadata: Record<string, unknown>;
}

export function classifyImportRunFailure(error: unknown): ImportRunFailureCategory {
  if (error instanceof SourceConnectorError) {
    if (error.code === 'configuration_invalid' || error.code === 'mapping_failed' || error.code === 'schema_invalid') {
      return 'source_configuration';
    }
    if (error.code === 'authentication_failed') {
      return 'source_configuration';
    }
    if (error.code === 'rate_limited' || error.code === 'timeout' || error.code === 'network_error') {
      return 'platform';
    }
    if (error.code === 'upstream_unavailable' || error.code === 'maintenance') {
      return 'platform';
    }
    return 'source_data';
  }

  if (error instanceof ImportError) {
    if (error.code === 'IMPORT_RECORD_LIMIT_EXCEEDED' || error.code === 'IMPORT_SOURCE_INACTIVE') {
      return 'platform';
    }
    return 'source_data';
  }

  return 'unknown';
}

export function buildImportRunReputationSummary(input: {
  job: ImportJob;
  publishResult?: ImportPublishBatchResult;
  failureCategory?: ImportRunFailureCategory;
  errorMessage?: string;
}): ImportRunReputationSummary {
  const metrics = input.job.metrics ?? {
    fetchedCount: 0,
    parsedCount: 0,
    invalidCount: 0,
    warningCount: 0,
    errorCount: 0,
    createdCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
  };

  return {
    importJobId: input.job.id,
    jobStatus: input.job.status,
    metrics,
    publishResult: input.publishResult,
    failureCategory: input.failureCategory,
    errorMessage: input.errorMessage,
    fetchedCount: metrics.fetchedCount,
    parsedCount: metrics.parsedCount,
    invalidCount: metrics.invalidCount,
    duplicateCount: metrics.duplicateCount,
    publishedCount: input.publishResult?.publishedCount ?? 0,
    queuedCount: input.publishResult?.queuedCount ?? 0,
    rejectedCount: input.publishResult?.rejectedCount ?? 0,
    heldCount: input.publishResult?.heldCount ?? 0,
    noRecordsFound: metrics.fetchedCount === 0,
    parsingErrorCount: metrics.invalidCount,
    mappingErrorCount: metrics.errorCount,
  };
}

export function decideImportRunReputation(
  summary: ImportRunReputationSummary,
): ImportRunReputationDecision {
  const metadata: Record<string, unknown> = {
    importJobId: summary.importJobId,
    jobStatus: summary.jobStatus,
    fetchedCount: summary.fetchedCount,
    parsedCount: summary.parsedCount,
    invalidCount: summary.invalidCount,
    duplicateCount: summary.duplicateCount,
    publishedCount: summary.publishedCount,
    queuedCount: summary.queuedCount,
    rejectedCount: summary.rejectedCount,
    heldCount: summary.heldCount,
    noRecordsFound: summary.noRecordsFound,
    parsingErrorCount: summary.parsingErrorCount,
    mappingErrorCount: summary.mappingErrorCount,
    failureCategory: summary.failureCategory,
    errorMessage: summary.errorMessage,
    technicalError: summary.jobStatus === 'failed' && summary.failureCategory === 'platform',
    recordsDiscarded: summary.invalidCount + summary.rejectedCount,
    movedToReview: summary.queuedCount + summary.heldCount,
    autoPublished: summary.publishedCount,
    duplicatesDetected: summary.duplicateCount,
  };

  if (summary.jobStatus === 'failed') {
    if (summary.failureCategory === 'platform') {
      return { eventType: null, metadata };
    }
    return { eventType: 'import_failure', metadata };
  }

  if (summary.noRecordsFound) {
    return { eventType: 'import_success', metadata: { ...metadata, outcome: 'no_records_found' } };
  }

  const discardRatio =
    summary.fetchedCount > 0
      ? (summary.invalidCount + summary.duplicateCount) / summary.fetchedCount
      : 0;

  if (discardRatio >= 0.5 && summary.parsedCount === 0) {
    return { eventType: 'quality_regression', metadata: { ...metadata, outcome: 'high_discard_ratio' } };
  }

  if (summary.publishedCount > 0 && summary.invalidCount === 0) {
    return { eventType: 'quality_improvement', metadata: { ...metadata, outcome: 'clean_publish_run' } };
  }

  return { eventType: 'import_success', metadata: { ...metadata, outcome: 'processed' } };
}
