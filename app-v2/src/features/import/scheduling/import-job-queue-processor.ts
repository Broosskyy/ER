import type { ImportAdminRepository } from '@/data/repositories/import-admin-repository';
import type { ImportJobRepository } from '@/data/repositories/import-repositories';
import type { SourceRecord } from '@/data/types/records';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import type { ImportJob } from '@/features/import/models/types';
import type { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { resolveImportRetry } from '@/features/import/services/import-retry-policy';
import { ImportJobQueueService } from './import-job-queue-service';
import type {
  ImportJobQueueEntry,
  ImportScheduleService,
} from './import-schedule-types';
import { resolveSourceConnectorKeyFromRecord } from '@/features/aggregation/connectors/source-connector-resolution';

export interface ImportJobQueueProcessorResult {
  processed: number;
  succeeded: number;
  failed: number;
  requeued: number;
  deadLettered: number;
  results: Array<{
    queueEntryId: string;
    sourceId: string;
    importJobId: string;
    success: boolean;
    errorMessage?: string;
  }>;
}

export class ImportJobQueueProcessor {
  constructor(
    private readonly queueService: ImportJobQueueService,
    private readonly jobRepository: ImportJobRepository,
    private readonly adminRepository: ImportAdminRepository,
    private readonly aggregationService: ImportAggregationService,
    private readonly scheduleService: ImportScheduleService,
    private readonly loggingService: ImportLoggingService,
    private readonly resolveSource: (sourceId: string) => Promise<SourceRecord | null>,
    private readonly shouldUseAggregation: (source: SourceRecord) => boolean,
  ) {}

  async processReadyJobs(
    limit: number,
    now = new Date(),
    workerId?: string,
  ): Promise<ImportJobQueueProcessorResult> {
    const effectiveWorkerId = workerId ?? `worker-${Date.now()}`;
    const entries = await this.queueService.claimReadyJobs(limit, now, effectiveWorkerId);
    const results: ImportJobQueueProcessorResult['results'] = [];
    let succeeded = 0;
    let failed = 0;
    let requeued = 0;
    let deadLettered = 0;

    for (const entry of entries) {
      const result = await this.processEntry(entry);
      results.push(result);
      if (result.success) {
        succeeded += 1;
      } else if (result.requeued) {
        requeued += 1;
      } else if (result.deadLettered) {
        deadLettered += 1;
      } else {
        failed += 1;
      }
    }

    return {
      processed: results.length,
      succeeded,
      failed,
      requeued,
      deadLettered,
      results,
    };
  }

  private async processEntry(entry: ImportJobQueueEntry): Promise<
    ImportJobQueueProcessorResult['results'][number] & {
      requeued?: boolean;
      deadLettered?: boolean;
    }
  > {
    const startedAt = new Date();

    try {
      const activeJob = await this.adminRepository.getActiveJobForSource(entry.sourceId);
      const job = await this.jobRepository.getById(entry.importJobId);
      if (!job) {
        throw new Error(`Import job ${entry.importJobId} not found.`);
      }
      if (activeJob && activeJob.id !== job.id && ['pending', 'running'].includes(activeJob.status)) {
        throw new Error('Another import is already active for this source.');
      }

      const source = await this.resolveSource(entry.sourceId);
      if (!source || !source.enabled || source.archived) {
        throw new Error(`Source ${entry.sourceId} is not available for import.`);
      }
      resolveSourceConnectorKeyFromRecord(source);
      if (!this.aggregationService) {
        throw new Error('Aggregation service is required for scheduled imports.');
      }

      const completedJob = await this.aggregationService.executeExistingJob(job, source, {
        recordImportReputation: false,
      });
      const success = completedJob.status === 'completed' || completedJob.status === 'completed_with_warnings';
      if (success) {
        await this.aggregationService.recordImportRunReputationForJob(source, completedJob);
        await this.scheduleService.recordSuccess(entry.sourceId, new Date());
        await this.queueService.markCompleted(entry);
      } else {
        const errorMessage = completedJob.errorSummary ?? `Import job ended with status ${completedJob.status}.`;
        await this.aggregationService.recordImportRunReputationForJob(source, completedJob, {
          errorMessage,
        });
        await this.scheduleService.recordFailure(entry.sourceId, new Date(), errorMessage);
        await this.queueService.markFailed(entry, errorMessage);
      }

      await this.loggingService.info(
        completedJob.id,
        'SCHEDULER_JOB_PROCESSED',
        `Scheduler processed queued job for ${source.displayName} (${completedJob.status}) in ${Date.now() - startedAt.getTime()}ms.`,
      );

      return {
        queueEntryId: entry.id,
        sourceId: entry.sourceId,
        importJobId: entry.importJobId,
        success,
        errorMessage: success ? undefined : completedJob.errorSummary,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Queue processing failed.';
      const attemptCount = (entry.attemptCount ?? 0) + 1;
      const maxAttempts = entry.maxAttempts ?? 3;
      const retryDecision = resolveImportRetry({ category: 'unknown' }, attemptCount);

      if (retryDecision.retryable && attemptCount < maxAttempts && retryDecision.delayMs != null) {
        const nextRetryAt = new Date(Date.now() + retryDecision.delayMs).toISOString();
        await this.queueService.requeueForRetry(entry, nextRetryAt, attemptCount);
        await this.loggingService.error(
          entry.importJobId,
          'SCHEDULER_JOB_REQUEUED',
          `Queue job requeued (attempt ${attemptCount}/${maxAttempts}): ${message}`,
        );
        return {
          queueEntryId: entry.id,
          sourceId: entry.sourceId,
          importJobId: entry.importJobId,
          success: false,
          errorMessage: message,
          requeued: true,
        };
      }

      await this.scheduleService.recordFailure(entry.sourceId, new Date(), message);
      await this.queueService.markDeadLetter(entry, message);
      const job = await this.jobRepository.getById(entry.importJobId);
      const source = await this.resolveSource(entry.sourceId);
      if (job && source) {
        await this.aggregationService.recordImportRunReputationForJob(source, job, {
          failureCategory: 'platform',
          errorMessage: message,
        });
      }
      await this.loggingService.error(entry.importJobId, 'SCHEDULER_JOB_DEAD_LETTER', message);
      return {
        queueEntryId: entry.id,
        sourceId: entry.sourceId,
        importJobId: entry.importJobId,
        success: false,
        errorMessage: message,
        deadLettered: true,
      };
    }
  }
}
