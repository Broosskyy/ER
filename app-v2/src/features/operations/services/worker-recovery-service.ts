import type { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import type { ImportScheduleRepository } from '@/features/import/scheduling/import-schedule-types';
import {
  DEFAULT_STALE_WORKER_RUN_MS,
  type WorkerRunRepository,
} from '@/features/import/scheduling/import-schedule-types';
import type {
  WorkerRecoveryRun,
  WorkerRecoveryRunRepository,
} from '../domain/operations-types';

const MAX_RECOVERY_ATTEMPTS = 3;

function createRecoveryRunId(): string {
  return `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface WorkerRecoveryOptions {
  now?: Date;
  maxQueueEntries?: number;
  staleWorkerRunMs?: number;
  actorId?: string;
}

export interface WorkerRecoveryResult {
  run: WorkerRecoveryRun;
}

export class WorkerRecoveryService {
  constructor(
    private readonly queueService: ImportJobQueueService,
    private readonly scheduleRepository: ImportScheduleRepository,
    private readonly workerRunRepository: WorkerRunRepository,
    private readonly recoveryRunRepository: WorkerRecoveryRunRepository,
  ) {}

  async runRecovery(options: WorkerRecoveryOptions = {}): Promise<WorkerRecoveryResult> {
    const now = options.now ?? new Date();
    const startedAt = now.toISOString();
    const run: WorkerRecoveryRun = {
      id: createRecoveryRunId(),
      startedAt,
      status: 'running',
      stuckQueueEntries: 0,
      recoveredQueueEntries: 0,
      deadLetteredQueueEntries: 0,
      expiredLocksReleased: 0,
      staleWorkerRunsReconciled: 0,
      metadata: { actorId: options.actorId ?? 'recovery' },
    };
    await this.recoveryRunRepository.create(run);

    try {
      const stuckEntries = await this.queueService.listStuckProcessing(
        now,
        options.maxQueueEntries ?? 100,
      );
      run.stuckQueueEntries = stuckEntries.length;

      for (const entry of stuckEntries) {
        const attemptCount = (entry.attemptCount ?? 0) + 1;
        const maxAttempts = entry.maxAttempts ?? MAX_RECOVERY_ATTEMPTS;

        if (attemptCount < maxAttempts) {
          const nextRetryAt = new Date(now.getTime() + 60_000).toISOString();
          await this.queueService.requeueForRetry(entry, nextRetryAt, attemptCount);
          run.recoveredQueueEntries += 1;
        } else {
          await this.queueService.markDeadLetter(
            entry,
            entry.errorSummary ?? 'Recovered stuck processing entry exceeded max attempts.',
          );
          run.deadLetteredQueueEntries += 1;
        }
      }

      run.expiredLocksReleased = await this.scheduleRepository.releaseExpiredLocks(now);

      const staleThreshold = new Date(
        now.getTime() - (options.staleWorkerRunMs ?? DEFAULT_STALE_WORKER_RUN_MS),
      );
      const staleRuns = await this.workerRunRepository.listStaleRunning(staleThreshold);
      for (const staleRun of staleRuns) {
        await this.workerRunRepository.update({
          ...staleRun,
          status: 'failed',
          finishedAt: now.toISOString(),
          errorSummary: 'Reconciled stale worker run after crash or timeout.',
          durationMs: now.getTime() - new Date(staleRun.startedAt).getTime(),
        });
        run.staleWorkerRunsReconciled += 1;
      }

      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      run.status =
        run.deadLetteredQueueEntries > 0
          ? run.recoveredQueueEntries > 0
            ? 'completed_with_errors'
            : 'failed'
          : 'completed';

      const savedRun = await this.recoveryRunRepository.update(run);
      return { run: savedRun };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Worker recovery failed.';
      run.finishedAt = new Date().toISOString();
      run.durationMs = new Date(run.finishedAt).getTime() - new Date(startedAt).getTime();
      run.status = 'failed';
      run.errorSummary = message;
      const savedRun = await this.recoveryRunRepository.update(run);
      return { run: savedRun };
    }
  }

  async listRecentRecoveryRuns(limit = 20): Promise<WorkerRecoveryRun[]> {
    return this.recoveryRunRepository.getLatest(limit);
  }
}
