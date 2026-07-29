import { DEFAULT_PROCESSING_LEASE_MS } from '@/features/import/scheduling/import-schedule-types';
import type { ImportJob } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import type {
  ImportJobQueueEntry,
  ImportJobQueueRepository,
} from './import-schedule-types';
function createQueueId(): string {
  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface EnqueueImportJobInput {
  source: SourceRecord;
  importJob: ImportJob;
  schedulerRunId?: string;
  scheduledFor?: string;
}

export class ImportJobQueueService {
  constructor(private readonly repository: ImportJobQueueRepository) {}

  async enqueueScheduledImport(input: EnqueueImportJobInput): Promise<ImportJobQueueEntry> {
    const now = new Date().toISOString();
    return this.repository.enqueue({
      id: createQueueId(),
      sourceId: input.source.id,
      importJobId: input.importJob.id,
      priority: input.source.priority,
      status: 'queued',
      scheduledFor: input.scheduledFor ?? now,
      enqueuedAt: now,
      schedulerRunId: input.schedulerRunId,
      triggerType: input.importJob.triggerType === 'scheduled' ? 'scheduled' : input.importJob.triggerType,
      attemptCount: 0,
      maxAttempts: 3,
      metadata: {
        sourceName: input.source.displayName,
      },
    });
  }

  async listReady(limit: number, now = new Date(), workerId?: string): Promise<ImportJobQueueEntry[]> {
    return this.repository.claimQueued({
      limit,
      now,
      workerId: workerId ?? `worker-${Date.now()}`,
    });
  }

  async claimReadyJobs(
    limit: number,
    now = new Date(),
    workerId: string,
    leaseMs = DEFAULT_PROCESSING_LEASE_MS,
  ): Promise<ImportJobQueueEntry[]> {
    return this.repository.claimQueued({ limit, now, workerId, leaseMs });
  }

  async markProcessing(entry: ImportJobQueueEntry, leaseMs = DEFAULT_PROCESSING_LEASE_MS): Promise<ImportJobQueueEntry> {
    const startedAt = new Date().toISOString();
    const processingLeaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
    return this.repository.enqueue({
      ...entry,
      status: 'processing',
      startedAt,
      processingStartedAt: startedAt,
      processingLeaseExpiresAt,
    });
  }

  async markCompleted(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry> {
    return this.repository.enqueue({
      ...entry,
      status: 'completed',
      finishedAt: new Date().toISOString(),
    });
  }

  async markFailed(entry: ImportJobQueueEntry, errorSummary: string): Promise<ImportJobQueueEntry> {
    return this.repository.enqueue({
      ...entry,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      errorSummary,
    });
  }

  async requeueForRetry(
    entry: ImportJobQueueEntry,
    nextRetryAt: string,
    attemptCount: number,
  ): Promise<ImportJobQueueEntry> {
    return this.repository.requeue({
      ...entry,
      status: 'queued',
      attemptCount,
      nextRetryAt,
      scheduledFor: nextRetryAt,
      startedAt: undefined,
      finishedAt: undefined,
      errorSummary: undefined,
      processingStartedAt: undefined,
      processingLeaseExpiresAt: undefined,
      workerId: undefined,
    });
  }

  async markDeadLetter(entry: ImportJobQueueEntry, errorSummary: string): Promise<ImportJobQueueEntry> {
    const finishedAt = new Date().toISOString();
    return this.repository.markDeadLetter(entry.id, finishedAt, errorSummary);
  }

  async findById(id: string): Promise<ImportJobQueueEntry | null> {
    return this.repository.findById(id);
  }

  async retryQueueEntry(entryId: string): Promise<ImportJobQueueEntry | null> {
    const entry = await this.repository.findById(entryId);
    if (!entry) {
      return null;
    }
    return this.repository.requeue({
      ...entry,
      status: 'queued',
      attemptCount: 0,
      deadLetteredAt: undefined,
      nextRetryAt: undefined,
      scheduledFor: new Date().toISOString(),
      startedAt: undefined,
      finishedAt: undefined,
      errorSummary: undefined,
      processingStartedAt: undefined,
      processingLeaseExpiresAt: undefined,
      workerId: undefined,
    });
  }

  async listDeadLettered(limit = 50): Promise<ImportJobQueueEntry[]> {
    return this.repository.listDeadLettered(limit);
  }

  async listStuckProcessing(now = new Date(), limit = 100): Promise<ImportJobQueueEntry[]> {
    const processing = await this.repository.listByStatus('processing', limit * 2);
    return processing
      .filter((entry) => {
        if (entry.processingLeaseExpiresAt) {
          return new Date(entry.processingLeaseExpiresAt).getTime() <= now.getTime();
        }
        if (!entry.startedAt) {
          return true;
        }
        return new Date(entry.startedAt).getTime() + DEFAULT_PROCESSING_LEASE_MS <= now.getTime();
      })
      .slice(0, limit);
  }
}
