export type ImportSchedulePolicy = 'interval' | 'cron' | 'manual_only' | 'paused';

export const DEFAULT_PROCESSING_LEASE_MS = 30 * 60_000;
export const DEFAULT_STALE_WORKER_RUN_MS = 60 * 60_000;

import type { ScheduleIntervalPreset } from './schedule-interval-preset';

export interface ImportScheduleState {
  sourceId: string;
  scheduleEnabled: boolean;
  schedulePolicy: ImportSchedulePolicy;
  scheduleIntervalPreset?: ScheduleIntervalPreset;
  schedulerMaintenanceMode?: boolean;
  pollingIntervalMinutes?: number;
  cronExpression?: string;
  timezone: string;
  priority?: number;
  nextScheduledAt?: string;
  lastScheduledAt?: string;
  lastSuccessfulImportAt?: string;
  lastFailedImportAt?: string;
  consecutiveFailures: number;
  backoffUntil?: string;
  lastSchedulerError?: string;
  lastSchedulerErrorAt?: string;
}

export interface ImportScheduleDueSource {
  sourceId: string;
  dueAt: string;
  reason: 'interval_due' | 'cron_due' | 'manual_retry';
}

export interface ImportScheduleRunResult {
  sourceId: string;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  errorMessage?: string;
  nextScheduledAt?: string;
  importJobId?: string;
  queueEntryId?: string;
}

export interface SchedulerRunRecord {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  sourcesScanned: number;
  sourcesDue: number;
  jobsEnqueued: number;
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  durationMs?: number;
  errorSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportJobQueueEntry {
  id: string;
  sourceId: string;
  importJobId: string;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduledFor: string;
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  schedulerRunId?: string;
  triggerType: 'scheduled' | 'manual' | 'webhook';
  errorSummary?: string;
  attemptCount?: number;
  maxAttempts?: number;
  nextRetryAt?: string;
  deadLetteredAt?: string;
  processingLeaseExpiresAt?: string;
  processingStartedAt?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
}

export interface ClaimQueuedJobsInput {
  limit: number;
  now: Date;
  workerId: string;
  leaseMs?: number;
}

export interface ImportJobQueueRepository {
  enqueue(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry>;
  listQueued(limit: number, now?: Date): Promise<ImportJobQueueEntry[]>;
  claimQueued(input: ClaimQueuedJobsInput): Promise<ImportJobQueueEntry[]>;
  listByStatus(status: ImportJobQueueEntry['status'], limit?: number): Promise<ImportJobQueueEntry[]>;
  markProcessing(id: string, startedAt: string): Promise<ImportJobQueueEntry>;
  markCompleted(id: string, finishedAt: string): Promise<ImportJobQueueEntry>;
  markFailed(id: string, finishedAt: string, errorSummary: string): Promise<ImportJobQueueEntry>;
  findByImportJobId(importJobId: string): Promise<ImportJobQueueEntry | null>;
  findById(id: string): Promise<ImportJobQueueEntry | null>;
  listBySourceId(sourceId: string, limit?: number): Promise<ImportJobQueueEntry[]>;
  requeue(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry>;
  markDeadLetter(id: string, finishedAt: string, errorSummary: string): Promise<ImportJobQueueEntry>;
  listDeadLettered(limit?: number): Promise<ImportJobQueueEntry[]>;
}

export interface WorkerRunRecord {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'skipped';
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  jobsRequeued: number;
  jobsDeadLettered: number;
  durationMs?: number;
  errorSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerRunRepository {
  create(run: WorkerRunRecord): Promise<WorkerRunRecord>;
  update(run: WorkerRunRecord): Promise<WorkerRunRecord>;
  getLatest(limit?: number): Promise<WorkerRunRecord[]>;
  listStaleRunning(olderThan: Date, limit?: number): Promise<WorkerRunRecord[]>;
}

export interface SchedulerRunRepository {
  create(run: SchedulerRunRecord): Promise<SchedulerRunRecord>;
  update(run: SchedulerRunRecord): Promise<SchedulerRunRecord>;
  getLatest(limit?: number): Promise<SchedulerRunRecord[]>;
  getById(id: string): Promise<SchedulerRunRecord | null>;
}

export interface ImportScheduleLock {
  sourceId: string;
  leaseId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface ImportScheduleRepository {
  getState(sourceId: string): Promise<ImportScheduleState | null>;
  listStates(): Promise<ImportScheduleState[]>;
  saveState(state: ImportScheduleState): Promise<void>;
  tryAcquireLock(sourceId: string, leaseId: string, expiresAt: string): Promise<boolean>;
  releaseLock(sourceId: string, leaseId: string): Promise<void>;
  releaseExpiredLocks(now?: Date): Promise<number>;
}

export interface ImportScheduleService {
  listDueSources(now: Date): Promise<ImportScheduleDueSource[]>;
  computeNextRun(state: ImportScheduleState, now: Date): string | undefined;
  recordSuccess(sourceId: string, completedAt: Date): Promise<ImportScheduleState>;
  recordFailure(sourceId: string, failedAt: Date, errorMessage: string): Promise<ImportScheduleState>;
  shouldSkip(state: ImportScheduleState, now: Date): { skip: boolean; reason?: string };
}
