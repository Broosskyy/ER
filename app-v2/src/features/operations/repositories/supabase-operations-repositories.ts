import {
  getRawSupabaseClient,
  resultOrThrow,
} from '@/data/supabase/supabase-query-client';
import type {
  ConnectorHealthSnapshot,
  ConnectorHealthSnapshotRepository,
  OperationsBackfillJob,
  OperationsBackfillJobRepository,
  PlatformOperationsState,
  PlatformOperationsStateRepository,
  SourceIntelligenceSnapshot,
  SourceIntelligenceSnapshotRepository,
  WorkerRecoveryRun,
  WorkerRecoveryRunRepository,
} from '../domain/operations-types';

function mapOpsStateRow(row: Record<string, unknown>): PlatformOperationsState {
  return {
    id: String(row.id),
    workerPaused: Boolean(row.worker_paused),
    schedulerPaused: Boolean(row.scheduler_paused),
    globalMaintenanceMode: Boolean(row.global_maintenance_mode),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    updatedAt: String(row.updated_at),
  };
}

function mapBackfillRow(row: Record<string, unknown>): OperationsBackfillJob {
  return {
    id: String(row.id),
    backfillType: row.backfill_type as OperationsBackfillJob['backfillType'],
    status: row.status as OperationsBackfillJob['status'],
    cursorValue: row.cursor_value ? String(row.cursor_value) : undefined,
    processedCount: Number(row.processed_count ?? 0),
    errorCount: Number(row.error_count ?? 0),
    batchSize: Number(row.batch_size ?? 500),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    startedAt: row.started_at ? String(row.started_at) : undefined,
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapIntelligenceRow(row: Record<string, unknown>): SourceIntelligenceSnapshot {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    availabilityScore: Number(row.availability_score ?? 0),
    successRate: Number(row.success_rate ?? 0),
    avgImportDurationMs:
      row.avg_import_duration_ms != null ? Number(row.avg_import_duration_ms) : undefined,
    errorRate: Number(row.error_rate ?? 0),
    lastSuccessfulSyncAt: row.last_successful_sync_at
      ? String(row.last_successful_sync_at)
      : undefined,
    lastErrorAt: row.last_error_at ? String(row.last_error_at) : undefined,
    lastErrorSummary: row.last_error_summary ? String(row.last_error_summary) : undefined,
    queueDepth: Number(row.queue_depth ?? 0),
    schedulerLoadScore: Number(row.scheduler_load_score ?? 0),
    pendingReviewCount: Number(row.pending_review_count ?? 0),
    matchEvaluationCount: Number(row.match_evaluation_count ?? 0),
    lifecycleChangeCount: Number(row.lifecycle_change_count ?? 0),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    computedAt: String(row.computed_at),
  };
}

const DEFAULT_OPS_STATE: PlatformOperationsState = {
  id: 'default',
  workerPaused: false,
  schedulerPaused: false,
  globalMaintenanceMode: false,
  metadata: {},
  updatedAt: new Date().toISOString(),
};

export class SupabasePlatformOperationsStateRepository implements PlatformOperationsStateRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async get(): Promise<PlatformOperationsState> {
    const result = await this.client()
      .from('platform_operations_state')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapOpsStateRow(row) : DEFAULT_OPS_STATE;
  }

  async save(state: PlatformOperationsState): Promise<PlatformOperationsState> {
    const result = await this.client()
      .from('platform_operations_state')
      .upsert(
        {
          id: state.id,
          worker_paused: state.workerPaused,
          scheduler_paused: state.schedulerPaused,
          global_maintenance_mode: state.globalMaintenanceMode,
          metadata: state.metadata ?? {},
          updated_at: state.updatedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapOpsStateRow(resultOrThrow(result) as Record<string, unknown>);
  }
}

export class SupabaseOperationsBackfillJobRepository implements OperationsBackfillJobRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async create(job: OperationsBackfillJob): Promise<OperationsBackfillJob> {
    const result = await this.client()
      .from('operations_backfill_jobs')
      .upsert(
        {
          id: job.id,
          backfill_type: job.backfillType,
          status: job.status,
          cursor_value: job.cursorValue ?? null,
          processed_count: job.processedCount,
          error_count: job.errorCount,
          batch_size: job.batchSize,
          metadata: job.metadata ?? {},
          started_at: job.startedAt ?? null,
          finished_at: job.finishedAt ?? null,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapBackfillRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async update(job: OperationsBackfillJob): Promise<OperationsBackfillJob> {
    return this.create(job);
  }

  async findById(id: string): Promise<OperationsBackfillJob | null> {
    const result = await this.client()
      .from('operations_backfill_jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapBackfillRow(row) : null;
  }

  async findActiveByType(backfillType: OperationsBackfillJob['backfillType']): Promise<OperationsBackfillJob | null> {
    const result = await this.client()
      .from('operations_backfill_jobs')
      .select('*')
      .eq('backfill_type', backfillType)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    const first = rows[0];
    return first ? mapBackfillRow(first) : null;
  }

  async listRecent(limit = 20): Promise<OperationsBackfillJob[]> {
    const result = await this.client()
      .from('operations_backfill_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapBackfillRow);
  }
}

export class SupabaseSourceIntelligenceSnapshotRepository
  implements SourceIntelligenceSnapshotRepository
{
  private client() {
    return getRawSupabaseClient();
  }

  async upsert(snapshot: SourceIntelligenceSnapshot): Promise<SourceIntelligenceSnapshot> {
    const result = await this.client()
      .from('source_intelligence_snapshots')
      .upsert(
        {
          id: snapshot.id,
          source_id: snapshot.sourceId,
          availability_score: snapshot.availabilityScore,
          success_rate: snapshot.successRate,
          avg_import_duration_ms: snapshot.avgImportDurationMs ?? null,
          error_rate: snapshot.errorRate,
          last_successful_sync_at: snapshot.lastSuccessfulSyncAt ?? null,
          last_error_at: snapshot.lastErrorAt ?? null,
          last_error_summary: snapshot.lastErrorSummary ?? null,
          queue_depth: snapshot.queueDepth,
          scheduler_load_score: snapshot.schedulerLoadScore,
          pending_review_count: snapshot.pendingReviewCount,
          match_evaluation_count: snapshot.matchEvaluationCount,
          lifecycle_change_count: snapshot.lifecycleChangeCount,
          metadata: snapshot.metadata ?? {},
          computed_at: snapshot.computedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapIntelligenceRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async getLatestBySourceId(sourceId: string): Promise<SourceIntelligenceSnapshot | null> {
    const result = await this.client()
      .from('source_intelligence_snapshots')
      .select('*')
      .eq('source_id', sourceId)
      .order('computed_at', { ascending: false })
      .limit(1);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    const first = rows[0];
    return first ? mapIntelligenceRow(first) : null;
  }

  async listBySourceId(sourceId: string, limit = 20): Promise<SourceIntelligenceSnapshot[]> {
    const result = await this.client()
      .from('source_intelligence_snapshots')
      .select('*')
      .eq('source_id', sourceId)
      .order('computed_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapIntelligenceRow);
  }

  async listRecent(limit = 50): Promise<SourceIntelligenceSnapshot[]> {
    const result = await this.client()
      .from('source_intelligence_snapshots')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapIntelligenceRow);
  }
}

function mapConnectorHealthRow(row: Record<string, unknown>): ConnectorHealthSnapshot {
  return {
    id: String(row.id),
    connectorKey: String(row.connector_key),
    sourceId: row.source_id ? String(row.source_id) : undefined,
    status: String(row.status),
    successRate: Number(row.success_rate ?? 0),
    errorCount: Number(row.error_count ?? 0),
    totalRunCount: Number(row.total_run_count ?? 0),
    averageDurationMs: Number(row.average_duration_ms ?? 0),
    lastResponseTimeMs:
      row.last_response_time_ms != null ? Number(row.last_response_time_ms) : undefined,
    lastSuccessfulRunAt: row.last_successful_run_at
      ? String(row.last_successful_run_at)
      : undefined,
    lastErrorAt: row.last_error_at ? String(row.last_error_at) : undefined,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : undefined,
    lastErrorMessage: row.last_error_message ? String(row.last_error_message) : undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    computedAt: String(row.computed_at),
  };
}

function mapRecoveryRunRow(row: Record<string, unknown>): WorkerRecoveryRun {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    status: row.status as WorkerRecoveryRun['status'],
    stuckQueueEntries: Number(row.stuck_queue_entries ?? 0),
    recoveredQueueEntries: Number(row.recovered_queue_entries ?? 0),
    deadLetteredQueueEntries: Number(row.dead_lettered_queue_entries ?? 0),
    expiredLocksReleased: Number(row.expired_locks_released ?? 0),
    staleWorkerRunsReconciled: Number(row.stale_worker_runs_reconciled ?? 0),
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
    errorSummary: row.error_summary ? String(row.error_summary) : undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

export class SupabaseConnectorHealthSnapshotRepository implements ConnectorHealthSnapshotRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async upsert(snapshot: ConnectorHealthSnapshot): Promise<ConnectorHealthSnapshot> {
    const result = await this.client()
      .from('connector_health_snapshots')
      .upsert(
        {
          id: snapshot.id,
          connector_key: snapshot.connectorKey,
          source_id: snapshot.sourceId ?? null,
          status: snapshot.status,
          success_rate: snapshot.successRate,
          error_count: snapshot.errorCount,
          total_run_count: snapshot.totalRunCount,
          average_duration_ms: snapshot.averageDurationMs,
          last_response_time_ms: snapshot.lastResponseTimeMs ?? null,
          last_successful_run_at: snapshot.lastSuccessfulRunAt ?? null,
          last_error_at: snapshot.lastErrorAt ?? null,
          last_error_code: snapshot.lastErrorCode ?? null,
          last_error_message: snapshot.lastErrorMessage ?? null,
          metadata: snapshot.metadata ?? {},
          computed_at: snapshot.computedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapConnectorHealthRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async getLatestByConnectorKey(connectorKey: string): Promise<ConnectorHealthSnapshot | null> {
    const result = await this.client()
      .from('connector_health_snapshots')
      .select('*')
      .eq('connector_key', connectorKey)
      .order('computed_at', { ascending: false })
      .limit(1);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    const first = rows[0];
    return first ? mapConnectorHealthRow(first) : null;
  }

  async listRecent(limit = 50): Promise<ConnectorHealthSnapshot[]> {
    const result = await this.client()
      .from('connector_health_snapshots')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapConnectorHealthRow);
  }
}

export class SupabaseWorkerRecoveryRunRepository implements WorkerRecoveryRunRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async create(run: WorkerRecoveryRun): Promise<WorkerRecoveryRun> {
    return this.update(run);
  }

  async update(run: WorkerRecoveryRun): Promise<WorkerRecoveryRun> {
    const result = await this.client()
      .from('worker_recovery_runs')
      .upsert(
        {
          id: run.id,
          started_at: run.startedAt,
          finished_at: run.finishedAt ?? null,
          status: run.status,
          stuck_queue_entries: run.stuckQueueEntries,
          recovered_queue_entries: run.recoveredQueueEntries,
          dead_lettered_queue_entries: run.deadLetteredQueueEntries,
          expired_locks_released: run.expiredLocksReleased,
          stale_worker_runs_reconciled: run.staleWorkerRunsReconciled,
          duration_ms: run.durationMs ?? null,
          error_summary: run.errorSummary ?? null,
          metadata: run.metadata ?? {},
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapRecoveryRunRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async getLatest(limit = 20): Promise<WorkerRecoveryRun[]> {
    const result = await this.client()
      .from('worker_recovery_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapRecoveryRunRow);
  }
}
