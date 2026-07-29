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

export class InMemoryImportJobQueueRepository implements ImportJobQueueRepository {
  private readonly entries = new Map<string, ImportJobQueueEntry>();

  async enqueue(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry> {
    this.entries.set(entry.id, { ...entry });
    return entry;
  }

  async listQueued(limit: number, now = new Date()): Promise<ImportJobQueueEntry[]> {
    return [...this.entries.values()]
      .filter(
        (entry) =>
          entry.status === 'queued' && new Date(entry.scheduledFor).getTime() <= now.getTime(),
      )
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        return left.scheduledFor.localeCompare(right.scheduledFor);
      })
      .slice(0, limit);
  }

  async claimQueued(input: ClaimQueuedJobsInput): Promise<ImportJobQueueEntry[]> {
    const leaseMs = input.leaseMs ?? DEFAULT_PROCESSING_LEASE_MS;
    const ready = [...this.entries.values()]
      .filter(
        (entry) =>
          entry.status === 'queued' &&
          new Date(entry.scheduledFor).getTime() <= input.now.getTime(),
      )
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        return left.scheduledFor.localeCompare(right.scheduledFor);
      });

    const claimed: ImportJobQueueEntry[] = [];
    for (const candidate of ready) {
      if (claimed.length >= input.limit) {
        break;
      }
      const current = this.entries.get(candidate.id);
      if (!current || current.status !== 'queued') {
        continue;
      }
      const startedAt = input.now.toISOString();
      const updated: ImportJobQueueEntry = {
        ...current,
        status: 'processing',
        startedAt,
        processingStartedAt: startedAt,
        processingLeaseExpiresAt: new Date(input.now.getTime() + leaseMs).toISOString(),
        workerId: input.workerId,
      };
      this.entries.set(candidate.id, updated);
      claimed.push(updated);
    }
    return claimed;
  }

  async listByStatus(status: ImportJobQueueEntry['status'], limit = 100): Promise<ImportJobQueueEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => entry.status === status)
      .slice(0, limit);
  }

  async markProcessing(id: string, startedAt: string): Promise<ImportJobQueueEntry> {
    const entry = this.requireEntry(id);
    const updated = { ...entry, status: 'processing' as const, startedAt };
    this.entries.set(id, updated);
    return updated;
  }

  async markCompleted(id: string, finishedAt: string): Promise<ImportJobQueueEntry> {
    const entry = this.requireEntry(id);
    const updated = { ...entry, status: 'completed' as const, finishedAt };
    this.entries.set(id, updated);
    return updated;
  }

  async markFailed(id: string, finishedAt: string, errorSummary: string): Promise<ImportJobQueueEntry> {
    const entry = this.requireEntry(id);
    const updated = {
      ...entry,
      status: 'failed' as const,
      finishedAt,
      errorSummary,
    };
    this.entries.set(id, updated);
    return updated;
  }

  async findByImportJobId(importJobId: string): Promise<ImportJobQueueEntry | null> {
    return [...this.entries.values()].find((entry) => entry.importJobId === importJobId) ?? null;
  }

  async listBySourceId(sourceId: string, limit = 20): Promise<ImportJobQueueEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => entry.sourceId === sourceId)
      .sort((left, right) => right.enqueuedAt.localeCompare(left.enqueuedAt))
      .slice(0, limit);
  }

  async findById(id: string): Promise<ImportJobQueueEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async requeue(entry: ImportJobQueueEntry): Promise<ImportJobQueueEntry> {
    const updated: ImportJobQueueEntry = {
      ...entry,
      status: 'queued',
      startedAt: undefined,
      finishedAt: undefined,
      errorSummary: undefined,
      processingStartedAt: undefined,
      processingLeaseExpiresAt: undefined,
      workerId: undefined,
    };
    this.entries.set(entry.id, updated);
    return updated;
  }

  async markDeadLetter(id: string, finishedAt: string, errorSummary: string): Promise<ImportJobQueueEntry> {
    const entry = this.requireEntry(id);
    const updated = {
      ...entry,
      status: 'failed' as const,
      finishedAt,
      errorSummary,
      deadLetteredAt: finishedAt,
    };
    this.entries.set(id, updated);
    return updated;
  }

  async listDeadLettered(limit = 50): Promise<ImportJobQueueEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => Boolean(entry.deadLetteredAt))
      .sort((left, right) => (right.deadLetteredAt ?? '').localeCompare(left.deadLetteredAt ?? ''))
      .slice(0, limit);
  }

  private requireEntry(id: string): ImportJobQueueEntry {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Queue entry ${id} not found.`);
    }
    return entry;
  }
}

export class InMemorySchedulerRunRepository implements SchedulerRunRepository {
  private readonly runs = new Map<string, SchedulerRunRecord>();

  async create(run: SchedulerRunRecord): Promise<SchedulerRunRecord> {
    this.runs.set(run.id, { ...run });
    return run;
  }

  async update(run: SchedulerRunRecord): Promise<SchedulerRunRecord> {
    this.runs.set(run.id, { ...run });
    return run;
  }

  async getLatest(limit = 20): Promise<SchedulerRunRecord[]> {
    return [...this.runs.values()]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit);
  }

  async getById(id: string): Promise<SchedulerRunRecord | null> {
    return this.runs.get(id) ?? null;
  }
}

export class InMemoryWorkerRunRepository implements WorkerRunRepository {
  private readonly runs = new Map<string, WorkerRunRecord>();

  async create(run: WorkerRunRecord): Promise<WorkerRunRecord> {
    this.runs.set(run.id, { ...run });
    return run;
  }

  async update(run: WorkerRunRecord): Promise<WorkerRunRecord> {
    this.runs.set(run.id, { ...run });
    return run;
  }

  async getLatest(limit = 20): Promise<WorkerRunRecord[]> {
    return [...this.runs.values()]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit);
  }

  async listStaleRunning(olderThan: Date, limit = 50): Promise<WorkerRunRecord[]> {
    return [...this.runs.values()]
      .filter(
        (run) =>
          run.status === 'running' &&
          new Date(run.startedAt).getTime() <= olderThan.getTime(),
      )
      .slice(0, limit);
  }
}
