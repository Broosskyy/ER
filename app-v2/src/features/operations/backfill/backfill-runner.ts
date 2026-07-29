import type {
  BackfillType,
  OperationsBackfillJob,
  OperationsBackfillJobRepository,
} from '../domain/operations-types';

export interface BackfillHandler {
  backfillType: BackfillType;
  processBatch(
    job: OperationsBackfillJob,
    batchSize: number,
  ): Promise<{ processed: number; errors: number; nextCursor?: string; completed: boolean }>;
}

function createBackfillJobId(backfillType: BackfillType): string {
  return `backfill-${backfillType}-${Date.now()}`;
}

export class BackfillRunner {
  constructor(
    private readonly jobRepository: OperationsBackfillJobRepository,
    private readonly handlers: BackfillHandler[],
  ) {}

  async start(backfillType: BackfillType, batchSize = 500): Promise<OperationsBackfillJob> {
    const active = await this.jobRepository.findActiveByType(backfillType);
    if (active) {
      return active;
    }

    const now = new Date().toISOString();
    return this.jobRepository.create({
      id: createBackfillJobId(backfillType),
      backfillType,
      status: 'pending',
      processedCount: 0,
      errorCount: 0,
      batchSize,
      createdAt: now,
      updatedAt: now,
    });
  }

  async runBatch(jobId: string): Promise<OperationsBackfillJob> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Backfill job ${jobId} not found.`);
    }
    if (job.status === 'completed' || job.status === 'cancelled') {
      return job;
    }

    const handler = this.handlers.find((entry) => entry.backfillType === job.backfillType);
    if (!handler) {
      throw new Error(`No handler registered for backfill type ${job.backfillType}.`);
    }

    const startedAt = job.startedAt ?? new Date().toISOString();
    const runningJob: OperationsBackfillJob = {
      ...job,
      status: 'running',
      startedAt,
      updatedAt: new Date().toISOString(),
    };
    await this.jobRepository.update(runningJob);

    try {
      const result = await handler.processBatch(runningJob, runningJob.batchSize);
      const updatedJob: OperationsBackfillJob = {
        ...runningJob,
        processedCount: runningJob.processedCount + result.processed,
        errorCount: runningJob.errorCount + result.errors,
        cursorValue: result.nextCursor ?? runningJob.cursorValue,
        status: result.completed ? 'completed' : 'running',
        finishedAt: result.completed ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      };
      return this.jobRepository.update(updatedJob);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Backfill batch failed.';
      return this.jobRepository.update({
        ...runningJob,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          ...runningJob.metadata,
          errorSummary: message,
        },
      });
    }
  }

  async listRecent(limit = 20): Promise<OperationsBackfillJob[]> {
    return this.jobRepository.listRecent(limit);
  }
}
