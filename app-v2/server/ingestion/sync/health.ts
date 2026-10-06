import type {
  IngestionErrorCategory,
  IngestionRunRecord,
  SourceHealthRecord,
  SourceHealthStatus,
  SyncRunCounters,
} from './types';
import { CONTENT_REVIEW_ERROR_CATEGORIES } from './types';

const ZERO_RESULT_THRESHOLD = 5;

export interface HealthEvaluationInput {
  connectorId: string;
  enabled: boolean;
  previousHealth?: SourceHealthRecord;
  run: Pick<IngestionRunRecord, 'status' | 'counters' | 'errorCategories'>;
}

export function createInitialSourceHealth(connectorId: string, enabled: boolean): SourceHealthRecord {
  return {
    connectorId,
    enabled,
    consecutiveFailures: 0,
    lastDiscoveredCount: 0,
    lastParsedCount: 0,
    lastAppliedCount: 0,
    contentReviewCount: 0,
    healthStatus: enabled ? 'unknown' : 'disabled',
  };
}

export function detectUnexpectedZeroResults(
  counters: SyncRunCounters,
  previousHealth: SourceHealthRecord | undefined,
  expectedMinParsed = ZERO_RESULT_THRESHOLD,
): boolean {
  if (counters.parsed > 0) {
    return false;
  }

  const baseline =
    previousHealth?.lastParsedCount && previousHealth.lastParsedCount >= expectedMinParsed
      ? previousHealth.lastParsedCount
      : expectedMinParsed;

  return baseline >= expectedMinParsed && counters.discovered === 0 && counters.fetched === 0;
}

export function hasTechnicalErrorCategories(errorCategories: IngestionErrorCategory[]): boolean {
  return errorCategories.some((category) => !CONTENT_REVIEW_ERROR_CATEGORIES.has(category));
}

export function isContentReviewOnlyRun(
  runStatus: IngestionRunRecord['status'],
  counters: SyncRunCounters,
  errorCategories: IngestionErrorCategory[],
): boolean {
  if (runStatus !== 'partially_succeeded' && runStatus !== 'succeeded') {
    return false;
  }
  if (counters.failures > 0 || counters.rejected > 0) {
    return false;
  }
  if (hasTechnicalErrorCategories(errorCategories)) {
    return false;
  }
  return counters.reviewRequired > 0 || errorCategories.some((category) => CONTENT_REVIEW_ERROR_CATEGORIES.has(category));
}

export function resolveHealthStatus(
  enabled: boolean,
  runStatus: IngestionRunRecord['status'],
  consecutiveFailures: number,
  hasZeroResultAnomaly: boolean,
  counters: SyncRunCounters,
  errorCategories: IngestionErrorCategory[],
): SourceHealthStatus {
  if (!enabled) {
    return 'disabled';
  }
  if (hasZeroResultAnomaly || consecutiveFailures >= 3) {
    return 'failing';
  }
  if (isContentReviewOnlyRun(runStatus, counters, errorCategories)) {
    return 'healthy';
  }
  if (runStatus === 'partially_succeeded' || consecutiveFailures > 0) {
    return 'degraded';
  }
  if (runStatus === 'failed') {
    return consecutiveFailures >= 2 ? 'failing' : 'degraded';
  }
  if (runStatus === 'succeeded' || runStatus === 'cancelled') {
    return runStatus === 'succeeded' ? 'healthy' : 'unknown';
  }
  return 'unknown';
}

export function updateSourceHealth(input: HealthEvaluationInput): SourceHealthRecord {
  const previous = input.previousHealth ?? createInitialSourceHealth(input.connectorId, input.enabled);
  const zeroResultAnomaly =
    input.run.errorCategories.includes('unexpected_zero_results') ||
    detectUnexpectedZeroResults(input.run.counters, previous);

  const contentReviewOnly = isContentReviewOnlyRun(
    input.run.status,
    input.run.counters,
    input.run.errorCategories,
  );
  const technicalSuccess =
    input.run.status === 'succeeded' || (input.run.status === 'partially_succeeded' && contentReviewOnly);
  const failed = input.run.status === 'failed';
  const consecutiveFailures = technicalSuccess
    ? 0
    : failed
      ? previous.consecutiveFailures + 1
      : previous.consecutiveFailures;

  const technicalErrors = input.run.errorCategories.filter(
    (category) => !CONTENT_REVIEW_ERROR_CATEGORIES.has(category),
  );
  const primaryError = technicalErrors[0] ?? input.run.errorCategories[0] ?? previous.lastErrorCategory;

  const healthStatus = resolveHealthStatus(
    input.enabled,
    input.run.status,
    consecutiveFailures,
    zeroResultAnomaly,
    input.run.counters,
    input.run.errorCategories,
  );

  const now = new Date().toISOString();
  const technicalPartialFailure =
    input.run.status === 'partially_succeeded' && !contentReviewOnly;

  return {
    connectorId: input.connectorId,
    enabled: input.enabled,
    lastAttemptAt: now,
    lastSuccessAt: technicalSuccess ? now : previous.lastSuccessAt,
    lastFailureAt: failed || technicalPartialFailure ? now : previous.lastFailureAt,
    consecutiveFailures,
    lastDurationMs: undefined,
    lastDiscoveredCount: input.run.counters.discovered,
    lastParsedCount: input.run.counters.parsed,
    lastAppliedCount: input.run.counters.appliedWrites,
    lastErrorCategory: primaryError,
    contentReviewCount: input.run.counters.reviewRequired,
    healthStatus,
  };
}

export function appendZeroResultAnomaly(
  errorCategories: IngestionErrorCategory[],
): IngestionErrorCategory[] {
  if (errorCategories.includes('unexpected_zero_results')) {
    return errorCategories;
  }
  return [...errorCategories, 'unexpected_zero_results'];
}
