import { AppError } from '@/core/errors/app-error';
import { getSupabaseClient } from '@/services/supabase/client';
import type {
  ClaimQueuedJobsInput,
  ImportJobQueueEntry,
  ImportJobQueueRepository,
  SchedulerRunRecord,
  SchedulerRunRepository,
  WorkerRunRecord,
  WorkerRunRepository,
} from './import-schedule-types';
import { DEFAULT_PROCESSING_LEASE_MS } from './import-schedule-types';

type RawResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

interface RawQuery extends PromiseLike<RawResult> {
  select(columns?: string, options?: { count?: 'exact' }): RawQuery;
  eq(column: string, value: unknown): RawQuery;
  in(column: string, values: unknown[]): RawQuery;
  order(column: string, options?: { ascending?: boolean }): RawQuery;
  limit(count: number): RawQuery;
  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): RawQuery;
  maybeSingle(): Promise<RawResult>;
  single(): Promise<RawResult>;
}

type RawClient = { from(table: string): RawQuery };

function throwRepositoryError(error: { message: string }): never {
  throw new AppError(error.message, { code: 'NETWORK', retryable: true, cause: error });
}

function resultOrThrow(result: RawResult): unknown {
  if (result.error) {
    throwRepositoryError(result.error);
  }
  return result.data;
}

function mapQueueRow(row: Record<string, unknown>): ImportJobQueueEntry {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    importJobId: String(row.import_job_id),
    priority: Number(row.priority ?? 50),
    status: row.status as ImportJobQueueEntry['status'],
    scheduledFor: String(row.scheduled_for),
    enqueuedAt: String(row.enqueued_at),
    startedAt: row.started_at ? String(row.started_at) : undefined,
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    schedulerRunId: row.scheduler_run_id ? String(row.scheduler_run_id) : undefined,
    triggerType: row.trigger_type as ImportJobQueueEntry['triggerType'],
    errorSummary: row.error_summary ? String(row.error_summary) : undefined,
    attemptCount: row.attempt_count != null ? Number(row.attempt_count) : undefined,
    maxAttempts: row.max_attempts != null ? Number(row.max_attempts) : undefined,
    nextRetryAt: row.next_retry_at ? String(row.next_retry_at) : undefined,
    deadLetteredAt: row.dead_lettered_at ? String(row.dead_lettered_at) : undefined,
    processingLeaseExpiresAt: row.processing_lease_expires_at
      ? String(row.processing_lease_expires_at)
      : undefined,
    processingStartedAt: row.processing_started_at ? String(row.processing_started_at) : undefined,
    workerId: row.worker_id ? String(row.worker_id) : undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

function queueRowPayload(entry: Partial<ImportJobQueueEntry> & { id: string }): Record<string, unknown> {
  return {
    id: entry.id,
    source_id: entry.sourceId,
    import_job_id: entry.importJobId,
    priority: entry.priority,
    status: entry.status,
    scheduled_for: entry.scheduledFor,
    enqueued_at: entry.enqueuedAt,
    started_at: entry.startedAt ?? null,
    finished_at: entry.finishedAt ?? null,
    scheduler_run_id: entry.schedulerRunId ?? null,
    trigger_type: entry.triggerType,
    error_summary: entry.errorSummary ?? null,
    attempt_count: entry.attemptCount ?? 0,
    max_attempts: entry.maxAttempts ?? 3,
    next_retry_at: entry.nextRetryAt ?? null,
    dead_lettered_at: entry.deadLetteredAt ?? null,
    processing_lease_expires_at: entry.processingLeaseExpiresAt ?? null,
    processing_started_at: entry.processingStartedAt ?? null,
    worker_id: entry.workerId ?? null,
    metadata: entry.metadata ?? {},
  };
}

function mapRunRow(row: Record<string, unknown>): SchedulerRunRecord {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    status: row.status as SchedulerRunRecord['status'],
    sourcesScanned: Number(row.sources_scanned ?? 0),
    sourcesDue: Number(row.sources_due ?? 0),
    jobsEnqueued: Number(row.jobs_enqueued ?? 0),
    jobsProcessed: Number(row.jobs_processed ?? 0),
    jobsSucceeded: Number(row.jobs_succeeded ?? 0),
    jobsFailed: Number(row.jobs_failed ?? 0),
    durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
    errorSummary: row.error_summary ? String(row.error_summary) : undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

export class SupabaseImportJobQueueRepository implements ImportJobQueueRepository {
  private client(): RawClient {
    return getSupabaseClient() as unknown as RawClient;
  }

  async enqueue(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry> {
    const result = await this.client()
      .from('import_job_queue')
      .upsert(queueRowPayload(entry), { onConflict: 'id' })
      .select('*')
      .single();
    return mapQueueRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async listQueued(limit: number, now = new Date()): Promise<ImportJobQueueEntry[]> {
    const result = await this.client()
      .from('import_job_queue')
      .select('*')
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows
      .map(mapQueueRow)
      .filter((entry) => new Date(entry.scheduledFor).getTime() <= now.getTime());
  }

  async claimQueued(input: ClaimQueuedJobsInput): Promise<ImportJobQueueEntry[]> {
    const client = getSupabaseClient() as unknown as {
      rpc(
        fn: string,
        args: Record<string, unknown>,
      ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
    const result = await client.rpc('claim_import_job_queue_entries', {
      p_limit: input.limit,
      p_now: input.now.toISOString(),
      p_worker_id: input.workerId,
      p_lease_ms: input.leaseMs ?? DEFAULT_PROCESSING_LEASE_MS,
    });
    if (result.error) {
      throwRepositoryError(result.error);
    }
    const rows = (result.data as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapQueueRow);
  }

  async listByStatus(status: ImportJobQueueEntry['status'], limit = 100): Promise<ImportJobQueueEntry[]> {
    const result = await this.client()
      .from('import_job_queue')
      .select('*')
      .eq('status', status)
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapQueueRow);
  }

  async markProcessing(id: string, startedAt: string): Promise<ImportJobQueueEntry> {
    const result = await this.client()
      .from('import_job_queue')
      .upsert({
        id,
        status: 'processing',
        started_at: startedAt,
      }, { onConflict: 'id' })
      .select('*')
      .single();
    return mapQueueRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async markCompleted(id: string, finishedAt: string): Promise<ImportJobQueueEntry> {
    const result = await this.client()
      .from('import_job_queue')
      .upsert({
        id,
        status: 'completed',
        finished_at: finishedAt,
      }, { onConflict: 'id' })
      .select('*')
      .single();
    return mapQueueRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async markFailed(id: string, finishedAt: string, errorSummary: string): Promise<ImportJobQueueEntry> {
    const result = await this.client()
      .from('import_job_queue')
      .upsert({
        id,
        status: 'failed',
        finished_at: finishedAt,
        error_summary: errorSummary,
      }, { onConflict: 'id' })
      .select('*')
      .single();
    return mapQueueRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async findByImportJobId(importJobId: string): Promise<ImportJobQueueEntry | null> {
    const result = await this.client()
      .from('import_job_queue')
      .select('*')
      .eq('import_job_id', importJobId)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapQueueRow(row) : null;
  }

  async listBySourceId(sourceId: string, limit = 20): Promise<ImportJobQueueEntry[]> {
    const result = await this.client()
      .from('import_job_queue')
      .select('*')
      .eq('source_id', sourceId)
      .order('enqueued_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapQueueRow);
  }

  async findById(id: string): Promise<ImportJobQueueEntry | null> {
    const result = await this.client()
      .from('import_job_queue')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapQueueRow(row) : null;
  }

  async requeue(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry> {
    return this.enqueue({
      ...entry,
      status: 'queued',
      startedAt: undefined,
      finishedAt: undefined,
      errorSummary: undefined,
    });
  }

  async markDeadLetter(id: string, finishedAt: string, errorSummary: string): Promise<ImportJobQueueEntry> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(`Queue entry ${id} not found.`, { code: 'NOT_FOUND', retryable: false });
    }
    return this.enqueue({
      ...existing,
      status: 'failed',
      finishedAt,
      errorSummary,
      deadLetteredAt: finishedAt,
    });
  }

  async listDeadLettered(limit = 50): Promise<ImportJobQueueEntry[]> {
    const result = await this.client()
      .from('import_job_queue')
      .select('*')
      .order('dead_lettered_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows
      .map(mapQueueRow)
      .filter((entry) => Boolean(entry.deadLetteredAt));
  }
}

export class SupabaseSchedulerRunRepository implements SchedulerRunRepository {
  private client(): RawClient {
    return getSupabaseClient() as unknown as RawClient;
  }

  async create(run: SchedulerRunRecord): Promise<SchedulerRunRecord> {
    const result = await this.client()
      .from('scheduler_runs')
      .upsert({
        id: run.id,
        started_at: run.startedAt,
        finished_at: run.finishedAt ?? null,
        status: run.status,
        sources_scanned: run.sourcesScanned,
        sources_due: run.sourcesDue,
        jobs_enqueued: run.jobsEnqueued,
        jobs_processed: run.jobsProcessed,
        jobs_succeeded: run.jobsSucceeded,
        jobs_failed: run.jobsFailed,
        duration_ms: run.durationMs ?? null,
        error_summary: run.errorSummary ?? null,
        metadata: run.metadata ?? {},
      }, { onConflict: 'id' })
      .select('*')
      .single();
    return mapRunRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async update(run: SchedulerRunRecord): Promise<SchedulerRunRecord> {
    return this.create(run);
  }

  async getLatest(limit = 20): Promise<SchedulerRunRecord[]> {
    const result = await this.client()
      .from('scheduler_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapRunRow);
  }

  async getById(id: string): Promise<SchedulerRunRecord | null> {
    const result = await this.client()
      .from('scheduler_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapRunRow(row) : null;
  }
}

function mapWorkerRunRow(row: Record<string, unknown>): WorkerRunRecord {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    status: row.status as WorkerRunRecord['status'],
    jobsProcessed: Number(row.jobs_processed ?? 0),
    jobsSucceeded: Number(row.jobs_succeeded ?? 0),
    jobsFailed: Number(row.jobs_failed ?? 0),
    jobsRequeued: Number(row.jobs_requeued ?? 0),
    jobsDeadLettered: Number(row.jobs_dead_lettered ?? 0),
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
    errorSummary: row.error_summary ? String(row.error_summary) : undefined,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

export class SupabaseWorkerRunRepository implements WorkerRunRepository {
  private client(): RawClient {
    return getSupabaseClient() as unknown as RawClient;
  }

  async create(run: WorkerRunRecord): Promise<WorkerRunRecord> {
    const result = await this.client()
      .from('worker_runs')
      .upsert(
        {
          id: run.id,
          started_at: run.startedAt,
          finished_at: run.finishedAt ?? null,
          status: run.status,
          jobs_processed: run.jobsProcessed,
          jobs_succeeded: run.jobsSucceeded,
          jobs_failed: run.jobsFailed,
          jobs_requeued: run.jobsRequeued,
          jobs_dead_lettered: run.jobsDeadLettered,
          duration_ms: run.durationMs ?? null,
          error_summary: run.errorSummary ?? null,
          metadata: run.metadata ?? {},
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapWorkerRunRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async update(run: WorkerRunRecord): Promise<WorkerRunRecord> {
    return this.create(run);
  }

  async getLatest(limit = 20): Promise<WorkerRunRecord[]> {
    const result = await this.client()
      .from('worker_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapWorkerRunRow);
  }

  async listStaleRunning(olderThan: Date, limit = 50): Promise<WorkerRunRecord[]> {
    const result = await this.client()
      .from('worker_runs')
      .select('*')
      .eq('status', 'running')
      .limit(limit * 2);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows
      .map(mapWorkerRunRow)
      .filter((run) => new Date(run.startedAt).getTime() <= olderThan.getTime())
      .slice(0, limit);
  }
}
