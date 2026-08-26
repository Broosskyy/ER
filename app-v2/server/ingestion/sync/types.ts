export type SyncRunMode = 'dry_run' | 'apply';

export type SyncTriggerType = 'manual' | 'scheduled' | 'retry' | 'test';

export type IngestionRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';

export type SourceHealthStatus = 'healthy' | 'degraded' | 'failing' | 'disabled' | 'unknown';

export type IngestionErrorCategory =
  | 'network_timeout'
  | 'rate_limited'
  | 'upstream_5xx'
  | 'invalid_response'
  | 'parser_degraded'
  | 'identity_ambiguous'
  | 'validation_rejected'
  | 'reconciliation_review'
  | 'apply_precondition_failed'
  | 'unexpected_zero_results'
  | 'source_disabled'
  | 'unknown';

export interface SyncRunCounters {
  discovered: number;
  fetched: number;
  parsed: number;
  candidates: number;
  planned: number;
  exactMatches: number;
  strongMatches: number;
  reviewRequired: number;
  newEvents: number;
  safeUpdates: number;
  noops: number;
  rejected: number;
  failures: number;
  appliedWrites: number;
}

export interface SyncRunSummary {
  runId: string;
  connectorId: string;
  startedAt: string;
  finishedAt?: string;
  counters: SyncRunCounters;
}

export function createEmptySyncRunCounters(): SyncRunCounters {
  return {
    discovered: 0,
    fetched: 0,
    parsed: 0,
    candidates: 0,
    planned: 0,
    exactMatches: 0,
    strongMatches: 0,
    reviewRequired: 0,
    newEvents: 0,
    safeUpdates: 0,
    noops: 0,
    rejected: 0,
    failures: 0,
    appliedWrites: 0,
  };
}

export interface IngestionRunRecord {
  runId: string;
  connectorId: string;
  mode: SyncRunMode;
  triggerType: SyncTriggerType;
  status: IngestionRunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  counters: SyncRunCounters;
  errorCategories: IngestionErrorCategory[];
  errorSummary?: string;
  retryCount: number;
}

export interface SourceHealthRecord {
  connectorId: string;
  enabled: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  consecutiveFailures: number;
  lastDurationMs?: number;
  lastDiscoveredCount: number;
  lastParsedCount: number;
  lastAppliedCount: number;
  lastErrorCategory?: IngestionErrorCategory;
  healthStatus: SourceHealthStatus;
}

export type SyncEventOutcome =
  | 'applied'
  | 'planned_only'
  | 'noop'
  | 'rejected'
  | 'review_required'
  | 'failed';

export interface SyncEventProcessingResult {
  sourceEventKey: string;
  officialUrl: string;
  outcome: SyncEventOutcome;
  errorCategory?: IngestionErrorCategory;
  errorMessage?: string;
}

export interface SyncRunRequest {
  connectorId: string;
  mode?: SyncRunMode;
  triggerType?: SyncTriggerType;
  maxDetailPages?: number;
}

export interface SyncRunResult {
  run: IngestionRunRecord;
  eventResults: SyncEventProcessingResult[];
  health: SourceHealthRecord;
}

export interface ApplyExecutionResult {
  applied: boolean;
  logicalOperations: number;
  databaseRowsInserted: number;
  databaseRowsUpdated: number;
  databaseRowsDeleted: number;
  ticketRowsChanged: number;
}
