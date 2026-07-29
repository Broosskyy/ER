export const BACKFILL_TYPES = [
  'blocking_keys',
  'lifecycle_history',
  'provenance',
  'source_intelligence',
] as const;

export type BackfillType = (typeof BACKFILL_TYPES)[number];

export const BACKFILL_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export type BackfillStatus = (typeof BACKFILL_STATUSES)[number];

export interface PlatformOperationsState {
  id: string;
  workerPaused: boolean;
  schedulerPaused: boolean;
  globalMaintenanceMode: boolean;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

export interface OperationsBackfillJob {
  id: string;
  backfillType: BackfillType;
  status: BackfillStatus;
  cursorValue?: string;
  processedCount: number;
  errorCount: number;
  batchSize: number;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceIntelligenceSnapshot {
  id: string;
  sourceId: string;
  availabilityScore: number;
  successRate: number;
  avgImportDurationMs?: number;
  errorRate: number;
  lastSuccessfulSyncAt?: string;
  lastErrorAt?: string;
  lastErrorSummary?: string;
  queueDepth: number;
  schedulerLoadScore: number;
  pendingReviewCount: number;
  matchEvaluationCount: number;
  lifecycleChangeCount: number;
  metadata?: Record<string, unknown>;
  computedAt: string;
}

export interface PlatformOperationsStateRepository {
  get(): Promise<PlatformOperationsState>;
  save(state: PlatformOperationsState): Promise<PlatformOperationsState>;
}

export interface OperationsBackfillJobRepository {
  create(job: OperationsBackfillJob): Promise<OperationsBackfillJob>;
  update(job: OperationsBackfillJob): Promise<OperationsBackfillJob>;
  findById(id: string): Promise<OperationsBackfillJob | null>;
  findActiveByType(backfillType: BackfillType): Promise<OperationsBackfillJob | null>;
  listRecent(limit?: number): Promise<OperationsBackfillJob[]>;
}

export interface SourceIntelligenceSnapshotRepository {
  upsert(snapshot: SourceIntelligenceSnapshot): Promise<SourceIntelligenceSnapshot>;
  getLatestBySourceId(sourceId: string): Promise<SourceIntelligenceSnapshot | null>;
  listBySourceId(sourceId: string, limit?: number): Promise<SourceIntelligenceSnapshot[]>;
  listRecent(limit?: number): Promise<SourceIntelligenceSnapshot[]>;
}

export type OperationsTriggerType = 'cron' | 'edge_function' | 'external_scheduler' | 'manual';

export interface OperationsTriggerRequest {
  triggerType: OperationsTriggerType;
  actorId?: string;
  batchSize?: number;
  processQueue?: boolean;
}

export interface ProductionMonitoringSnapshot {
  scheduler: {
    latestRuns: unknown[];
    dueSourceCount: number;
    sourcesInBackoff: number;
    activeQueueDepth: number;
    schedulerPaused: boolean;
  };
  worker: {
    latestRuns: unknown[];
    workerPaused: boolean;
    deadLetterCount: number;
    processingJobCount: number;
  };
  queue: {
    queuedCount: number;
    processingCount: number;
    retryCount: number;
    deadLetterCount: number;
    stuckProcessingCount: number;
  };
  imports: {
    lastSuccessfulImportAt?: string;
    lastFailedImportAt?: string;
    lastSuccessfulSourceId?: string;
    lastFailedSourceId?: string;
  };
  bootshaus?: {
    sourceId: string;
    schedulePolicy: string;
    scheduleEnabled: boolean;
    nextScheduledAt?: string;
    lastSuccessfulImportAt?: string;
    lastFailedImportAt?: string;
    consecutiveFailures: number;
    currentlyRunning: boolean;
    queuedJobs: number;
    lastSchedulerError?: string;
  };
  platform: {
    globalMaintenanceMode: boolean;
  };
  review: {
    pendingCount: number;
  };
  matching: {
    pendingMergeCandidates: number;
  };
  lifecycle: {
    recentHistoryCount: number;
  };
  recovery: {
    latestRuns: WorkerRecoveryRun[];
    stuckQueueCount: number;
  };
  connector: {
    latestSnapshots: ConnectorHealthSnapshot[];
  };
  backfill: {
    recentJobs: OperationsBackfillJob[];
  };
}

export interface ConnectorHealthSnapshot {
  id: string;
  connectorKey: string;
  sourceId?: string;
  status: string;
  successRate: number;
  errorCount: number;
  totalRunCount: number;
  averageDurationMs: number;
  lastResponseTimeMs?: number;
  lastSuccessfulRunAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  metadata?: Record<string, unknown>;
  computedAt: string;
}

export interface WorkerRecoveryRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  stuckQueueEntries: number;
  recoveredQueueEntries: number;
  deadLetteredQueueEntries: number;
  expiredLocksReleased: number;
  staleWorkerRunsReconciled: number;
  durationMs?: number;
  errorSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorHealthSnapshotRepository {
  upsert(snapshot: ConnectorHealthSnapshot): Promise<ConnectorHealthSnapshot>;
  getLatestByConnectorKey(connectorKey: string): Promise<ConnectorHealthSnapshot | null>;
  listRecent(limit?: number): Promise<ConnectorHealthSnapshot[]>;
}

export interface WorkerRecoveryRunRepository {
  create(run: WorkerRecoveryRun): Promise<WorkerRecoveryRun>;
  update(run: WorkerRecoveryRun): Promise<WorkerRecoveryRun>;
  getLatest(limit?: number): Promise<WorkerRecoveryRun[]>;
}
