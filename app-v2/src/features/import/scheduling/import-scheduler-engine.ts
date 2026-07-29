import type { ImportAdminRepository } from '@/data/repositories/import-admin-repository';
import type { SourceRecord } from '@/data/types/records';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import type { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportJobQueueProcessor } from './import-job-queue-processor';
import { ImportJobQueueService } from './import-job-queue-service';
import type {
  ImportScheduleRepository,
  ImportScheduleService,
  SchedulerRunRecord,
  SchedulerRunRepository,
} from './import-schedule-types';

const DEFAULT_LOCK_LEASE_MS = 5 * 60_000;
const DEFAULT_QUEUE_BATCH_SIZE = 10;

function createSchedulerRunId(): string {
  return `sched-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createLeaseId(): string {
  return `lease-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface ImportSchedulerTickOptions {
  now?: Date;
  queueBatchSize?: number;
  actorId?: string;
  /** When false (default), scheduler only enqueues — worker processes separately. */
  processQueue?: boolean;
}

export interface ImportSchedulerTickResult {
  run: SchedulerRunRecord;
  dueSourceIds: string[];
  enqueuedJobIds: string[];
  processorResult: Awaited<ReturnType<ImportJobQueueProcessor['processReadyJobs']>> | null;
}

export class ImportSchedulerEngine {
  constructor(
    private readonly scheduleService: ImportScheduleService,
    private readonly scheduleRepository: ImportScheduleRepository,
    private readonly schedulerRunRepository: SchedulerRunRepository,
    private readonly queueService: ImportJobQueueService,
    private readonly queueProcessor: ImportJobQueueProcessor,
    private readonly aggregationService: ImportAggregationService,
    private readonly adminRepository: ImportAdminRepository,
    private readonly loggingService: ImportLoggingService,
    private readonly resolveSource: (sourceId: string) => Promise<SourceRecord | null>,
    private readonly shouldUseAggregation: (source: SourceRecord) => boolean,
  ) {}

  async tick(options: ImportSchedulerTickOptions = {}): Promise<ImportSchedulerTickResult> {
    const now = options.now ?? new Date();
    const startedAt = now.toISOString();
    const run: SchedulerRunRecord = {
      id: createSchedulerRunId(),
      startedAt,
      status: 'running',
      sourcesScanned: 0,
      sourcesDue: 0,
      jobsEnqueued: 0,
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      metadata: {
        actorId: options.actorId ?? 'scheduler',
      },
    };
    await this.schedulerRunRepository.create(run);

    const dueSourceIds: string[] = [];
    const enqueuedJobIds: string[] = [];

    try {
      const states = await this.scheduleRepository.listStates();
      run.sourcesScanned = states.length;
      const dueSources = await this.scheduleService.listDueSources(now);
      run.sourcesDue = dueSources.length;

      for (const due of dueSources) {
        const enqueued = await this.enqueueDueSource(due.sourceId, run.id, now, options.actorId);
        if (enqueued) {
          dueSourceIds.push(due.sourceId);
          enqueuedJobIds.push(enqueued.importJobId);
          run.jobsEnqueued += 1;
        }
      }

      const processorResult = options.processQueue
        ? await this.queueProcessor.processReadyJobs(
            options.queueBatchSize ?? DEFAULT_QUEUE_BATCH_SIZE,
            now,
          )
        : null;
      run.jobsProcessed = processorResult?.processed ?? 0;
      run.jobsSucceeded = processorResult?.succeeded ?? 0;
      run.jobsFailed = processorResult?.failed ?? 0;
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      run.status =
        processorResult && processorResult.failed > 0
          ? processorResult.succeeded > 0
            ? 'completed_with_errors'
            : 'failed'
          : 'completed';

      const savedRun = await this.schedulerRunRepository.update(run);

      return {
        run: savedRun,
        dueSourceIds,
        enqueuedJobIds,
        processorResult,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Scheduler tick failed.';
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      run.status = 'failed';
      run.errorSummary = message;
      const savedRun = await this.schedulerRunRepository.update(run);
      return {
        run: savedRun,
        dueSourceIds,
        enqueuedJobIds,
        processorResult: null,
      };
    }
  }

  private async enqueueDueSource(
    sourceId: string,
    schedulerRunId: string,
    now: Date,
    actorId?: string,
  ): Promise<{ importJobId: string; queueEntryId: string } | null> {
    const state = await this.scheduleRepository.getState(sourceId);
    if (!state) {
      return null;
    }

    const skip = this.scheduleService.shouldSkip(state, now);
    if (skip.skip) {
      return null;
    }

    const activeJob = await this.adminRepository.getActiveJobForSource(sourceId);
    if (activeJob) {
      return null;
    }

    const leaseId = createLeaseId();
    const expiresAt = new Date(now.getTime() + DEFAULT_LOCK_LEASE_MS).toISOString();
    const acquired = await this.scheduleRepository.tryAcquireLock(sourceId, leaseId, expiresAt);
    if (!acquired) {
      return null;
    }

    try {
      const source = await this.resolveSource(sourceId);
      if (!source || !source.enabled || source.archived || source.schedulerMaintenanceMode) {
        return null;
      }
      if (!this.shouldUseAggregation(source)) {
        return null;
      }

      const job = await this.aggregationService.enqueueJob(source, 'scheduled', actorId ?? 'scheduler');
      const queueEntry = await this.queueService.enqueueScheduledImport({
        source,
        importJob: job,
        schedulerRunId,
        scheduledFor: now.toISOString(),
      });

      const nextState = {
        ...state,
        lastScheduledAt: now.toISOString(),
      };
      await this.scheduleRepository.saveState(nextState);

      await this.loggingService.info(
        job.id,
        'SCHEDULER_JOB_ENQUEUED',
        `Scheduler enqueued import job for ${source.displayName}.`,
      );

      return { importJobId: job.id, queueEntryId: queueEntry.id };
    } finally {
      await this.scheduleRepository.releaseLock(sourceId, leaseId);
    }
  }
}
