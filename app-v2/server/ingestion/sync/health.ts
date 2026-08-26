import type {
  IngestionErrorCategory,
  IngestionRunRecord,
  SourceHealthRecord,
  SourceHealthStatus,
  SyncRunCounters,
} from './types';

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

export function resolveHealthStatus(
  enabled: boolean,
  runStatus: IngestionRunRecord['status'],
  consecutiveFailures: number,
  hasZeroResultAnomaly: boolean,
): SourceHealthStatus {
  if (!enabled) {
    return 'disabled';
  }
  if (hasZeroResultAnomaly || consecutiveFailures >= 3) {
    return 'failing';
  }
  if (runStatus === 'partially_succeeded' || consecutiveFailures > 0) {
    return 'degraded';
  }
  if (runStatus === 'failed') {
    return consecutiveFailures >= 2 ? 'failing' : 'degraded';
  }
  if (runStatus === 'succeeded') {
    return 'healthy';
  }
  return 'unknown';
}

export function updateSourceHealth(input: HealthEvaluationInput): SourceHealthRecord {
  const previous = input.previousHealth ?? createInitialSourceHealth(input.connectorId, input.enabled);
  const zeroResultAnomaly =
    input.run.errorCategories.includes('unexpected_zero_results') ||
    detectUnexpectedZeroResults(input.run.counters, previous);

  const succeeded = input.run.status === 'succeeded';
  const failed = input.run.status === 'failed';
  const consecutiveFailures = succeeded ? 0 : failed ? previous.consecutiveFailures + 1 : previous.consecutiveFailures;

  const primaryError = input.run.errorCategories[0] ?? previous.lastErrorCategory;

  const healthStatus = resolveHealthStatus(
    input.enabled,
    input.run.status,
    consecutiveFailures,
    zeroResultAnomaly,
  );

  const now = new Date().toISOString();

  return {
    connectorId: input.connectorId,
    enabled: input.enabled,
    lastAttemptAt: now,
    lastSuccessAt: succeeded ? now : previous.lastSuccessAt,
    lastFailureAt: failed || input.run.status === 'partially_succeeded' ? now : previous.lastFailureAt,
    consecutiveFailures,
    lastDurationMs: undefined,
    lastDiscoveredCount: input.run.counters.discovered,
    lastParsedCount: input.run.counters.parsed,
    lastAppliedCount: input.run.counters.appliedWrites,
    lastErrorCategory: primaryError,
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
