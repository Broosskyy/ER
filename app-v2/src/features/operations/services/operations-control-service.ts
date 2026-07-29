import type { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import type { ImportSchedulerEngine } from '@/features/import/scheduling/import-scheduler-engine';
import type {
  OperationsBackfillJobRepository,
  OperationsTriggerRequest,
  PlatformOperationsStateRepository,
} from '../domain/operations-types';
import type { ImportJobQueueWorker } from './import-job-queue-worker';
import type { WorkerRecoveryService } from './worker-recovery-service';

export class OperationsTriggerService {
  constructor(
    private readonly schedulerEngine: ImportSchedulerEngine,
    private readonly queueWorker: ImportJobQueueWorker,
    private readonly operationsStateRepository: PlatformOperationsStateRepository,
    private readonly operationsControlService: OperationsControlService,
  ) {}

  async triggerScheduler(request: OperationsTriggerRequest = { triggerType: 'manual' }) {
    const opsState = await this.operationsStateRepository.get();
    if (opsState.schedulerPaused || opsState.globalMaintenanceMode) {
      return {
        skipped: true,
        reason: opsState.globalMaintenanceMode ? 'global_maintenance_mode' : 'scheduler_paused',
      };
    }

    return this.schedulerEngine.tick({
      actorId: request.actorId ?? request.triggerType,
      queueBatchSize: request.batchSize,
      processQueue: request.processQueue ?? false,
    });
  }

  async triggerWorker(request: OperationsTriggerRequest = { triggerType: 'manual' }) {
    return this.queueWorker.processBatch({
      actorId: request.actorId ?? request.triggerType,
      batchSize: request.batchSize,
    });
  }

  async triggerFullCycle(request: OperationsTriggerRequest = { triggerType: 'manual' }) {
    const schedulerResult = await this.triggerScheduler(request);
    const workerResult = await this.triggerWorker(request);
    return { schedulerResult, workerResult };
  }

  async triggerRecovery(actorId?: string) {
    return this.operationsControlService.runWorkerRecovery(actorId ?? 'recovery-trigger');
  }
}

export class OperationsControlService {
  constructor(
    private readonly operationsStateRepository: PlatformOperationsStateRepository,
    private readonly queueService: ImportJobQueueService,
    private readonly workerRecoveryService?: WorkerRecoveryService,
    private readonly backfillJobRepository?: OperationsBackfillJobRepository,
  ) {}

  async getState() {
    return this.operationsStateRepository.get();
  }

  async pauseWorker(): Promise<void> {
    const state = await this.operationsStateRepository.get();
    await this.operationsStateRepository.save({
      ...state,
      workerPaused: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async resumeWorker(): Promise<void> {
    const state = await this.operationsStateRepository.get();
    await this.operationsStateRepository.save({
      ...state,
      workerPaused: false,
      updatedAt: new Date().toISOString(),
    });
  }

  async pauseScheduler(): Promise<void> {
    const state = await this.operationsStateRepository.get();
    await this.operationsStateRepository.save({
      ...state,
      schedulerPaused: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async resumeScheduler(): Promise<void> {
    const state = await this.operationsStateRepository.get();
    await this.operationsStateRepository.save({
      ...state,
      schedulerPaused: false,
      updatedAt: new Date().toISOString(),
    });
  }

  async setGlobalMaintenanceMode(enabled: boolean): Promise<void> {
    const state = await this.operationsStateRepository.get();
    await this.operationsStateRepository.save({
      ...state,
      globalMaintenanceMode: enabled,
      updatedAt: new Date().toISOString(),
    });
  }

  async retryQueueEntry(queueEntryId: string) {
    return this.queueService.retryQueueEntry(queueEntryId);
  }

  async listDeadLetterEntries(limit = 50) {
    return this.queueService.listDeadLettered(limit);
  }

  async runWorkerRecovery(actorId = 'admin-recovery') {
    if (!this.workerRecoveryService) {
      throw new Error('Worker recovery service is not configured.');
    }
    return this.workerRecoveryService.runRecovery({ actorId });
  }

  async listRecentRecoveryRuns(limit = 20) {
    if (!this.workerRecoveryService) {
      return [];
    }
    return this.workerRecoveryService.listRecentRecoveryRuns(limit);
  }

  async listRecentBackfillJobs(limit = 20) {
    if (!this.backfillJobRepository) {
      return [];
    }
    return this.backfillJobRepository.listRecent(limit);
  }

  async listStuckQueueEntries(limit = 100) {
    return this.queueService.listStuckProcessing(new Date(), limit);
  }
}
