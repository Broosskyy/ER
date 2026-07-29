import type { ImportJobQueueProcessor } from '@/features/import/scheduling/import-job-queue-processor';
import type { WorkerRunRecord, WorkerRunRepository } from '@/features/import/scheduling/import-schedule-types';
import type { PlatformOperationsStateRepository } from '../domain/operations-types';

const DEFAULT_BATCH_SIZE = 10;

function createWorkerRunId(): string {
  return `worker-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface ImportJobQueueWorkerOptions {
  now?: Date;
  batchSize?: number;
  actorId?: string;
}

export interface ImportJobQueueWorkerResult {
  run: WorkerRunRecord;
  processorResult: Awaited<ReturnType<ImportJobQueueProcessor['processReadyJobs']>>;
}

export class ImportJobQueueWorker {
  constructor(
    private readonly queueProcessor: ImportJobQueueProcessor,
    private readonly workerRunRepository: WorkerRunRepository,
    private readonly operationsStateRepository: PlatformOperationsStateRepository,
  ) {}

  async processBatch(options: ImportJobQueueWorkerOptions = {}): Promise<ImportJobQueueWorkerResult> {
    const now = options.now ?? new Date();
    const startedAt = now.toISOString();
    const opsState = await this.operationsStateRepository.get();

    const run: WorkerRunRecord = {
      id: createWorkerRunId(),
      startedAt,
      status: 'running',
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      jobsRequeued: 0,
      jobsDeadLettered: 0,
      metadata: {
        actorId: options.actorId ?? 'worker',
      },
    };
    await this.workerRunRepository.create(run);

    if (opsState.workerPaused || opsState.globalMaintenanceMode) {
      run.finishedAt = new Date().toISOString();
      run.status = 'skipped';
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      const savedRun = await this.workerRunRepository.update(run);
      return {
        run: savedRun,
        processorResult: {
          processed: 0,
          succeeded: 0,
          failed: 0,
          requeued: 0,
          deadLettered: 0,
          results: [],
        },
      };
    }

    try {
      const processorResult = await this.queueProcessor.processReadyJobs(
        options.batchSize ?? DEFAULT_BATCH_SIZE,
        now,
        run.id,
      );
      run.jobsProcessed = processorResult.processed;
      run.jobsSucceeded = processorResult.succeeded;
      run.jobsFailed = processorResult.failed;
      run.jobsRequeued = processorResult.requeued;
      run.jobsDeadLettered = processorResult.deadLettered;
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      run.status =
        processorResult.failed > 0 || processorResult.deadLettered > 0
          ? processorResult.succeeded > 0
            ? 'completed_with_errors'
            : 'failed'
          : 'completed';

      const savedRun = await this.workerRunRepository.update(run);
      return { run: savedRun, processorResult };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Worker batch failed.';
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      run.status = 'failed';
      run.errorSummary = message;
      const savedRun = await this.workerRunRepository.update(run);
      return {
        run: savedRun,
        processorResult: {
          processed: 0,
          succeeded: 0,
          failed: 0,
          requeued: 0,
          deadLettered: 0,
          results: [],
        },
      };
    }
  }
}
