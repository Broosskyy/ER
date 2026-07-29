import type { EventLifecycleHistoryRepository } from '@/features/event-lifecycle/domain/lifecycle-engine-types';
import type { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import type { ImportSchedulerMonitoringService } from '@/features/import/scheduling/import-scheduler-monitoring';
import type { ImportJobQueueRepository, WorkerRunRepository } from '@/features/import/scheduling/import-schedule-types';
import type { EventMergeCandidateRepository } from '@/features/multi-source-matching/domain/matching-types';
import type { ImportReviewQueueRepository } from '@/features/trust-quality/domain/trust-quality-types';
import { PRODUCTION_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/production-source-records';
import type {
  ConnectorHealthSnapshotRepository,
  OperationsBackfillJobRepository,
  PlatformOperationsStateRepository,
  ProductionMonitoringSnapshot,
  WorkerRecoveryRunRepository,
} from '../domain/operations-types';

export class ProductionOperationsMonitoringService {
  constructor(
    private readonly schedulerMonitoring: ImportSchedulerMonitoringService,
    private readonly workerRunRepository: WorkerRunRepository,
    private readonly operationsStateRepository: PlatformOperationsStateRepository,
    private readonly queueRepository: ImportJobQueueRepository,
    private readonly reviewQueueRepository: ImportReviewQueueRepository,
    private readonly mergeCandidateRepository: EventMergeCandidateRepository,
    private readonly lifecycleHistoryRepository: EventLifecycleHistoryRepository,
    private readonly recoveryRunRepository?: WorkerRecoveryRunRepository,
    private readonly connectorHealthRepository?: ConnectorHealthSnapshotRepository,
    private readonly backfillJobRepository?: OperationsBackfillJobRepository,
    private readonly queueService?: ImportJobQueueService,
  ) {}

  async getSnapshot(now = new Date()): Promise<ProductionMonitoringSnapshot> {
    const [
      schedulerSnapshot,
      opsState,
      deadLetterEntries,
      queuedEntries,
      processingEntries,
      pendingReviews,
      pendingMerges,
      recentLifecycle,
      latestWorkerRuns,
      latestRecoveryRuns,
      connectorSnapshots,
      recentBackfillJobs,
      stuckQueueEntries,
      bootshausStatus,
    ] = await Promise.all([
      this.schedulerMonitoring.getSnapshot(now),
      this.operationsStateRepository.get(),
      this.queueRepository.listDeadLettered(1000),
      this.queueRepository.listQueued(1000, now),
      this.queueRepository.listByStatus('processing', 1000),
      this.reviewQueueRepository.listPending(1000),
      this.mergeCandidateRepository.listPending(1000),
      this.lifecycleHistoryRepository.listRecent(100),
      this.workerRunRepository.getLatest(10),
      this.recoveryRunRepository?.getLatest(10) ?? Promise.resolve([]),
      this.connectorHealthRepository?.listRecent(20) ?? Promise.resolve([]),
      this.backfillJobRepository?.listRecent(10) ?? Promise.resolve([]),
      this.queueService?.listStuckProcessing(now, 1000) ?? Promise.resolve([]),
      this.schedulerMonitoring.getSourceStatus(PRODUCTION_BOOTSHAUS_SOURCE_ID),
    ]);

    const retryCount = [...queuedEntries, ...processingEntries].filter(
      (entry) => (entry.attemptCount ?? 0) > 0,
    ).length;

    const scheduleStates = await this.schedulerMonitoring.listScheduleStates();
    const lastSuccess = scheduleStates
      .filter((state) => state.lastSuccessfulImportAt)
      .sort((left, right) =>
        (right.lastSuccessfulImportAt ?? '').localeCompare(left.lastSuccessfulImportAt ?? ''),
      )[0];
    const lastFailure = scheduleStates
      .filter((state) => state.lastFailedImportAt)
      .sort((left, right) =>
        (right.lastFailedImportAt ?? '').localeCompare(left.lastFailedImportAt ?? ''),
      )[0];

    return {
      scheduler: {
        latestRuns: schedulerSnapshot.latestRuns,
        dueSourceCount: schedulerSnapshot.dueSourceCount,
        sourcesInBackoff: schedulerSnapshot.sourcesInBackoff,
        activeQueueDepth: schedulerSnapshot.activeQueueDepth,
        schedulerPaused: opsState.schedulerPaused,
      },
      worker: {
        latestRuns: latestWorkerRuns,
        workerPaused: opsState.workerPaused,
        deadLetterCount: deadLetterEntries.length,
        processingJobCount: processingEntries.length,
      },
      queue: {
        queuedCount: queuedEntries.length,
        processingCount: processingEntries.length,
        retryCount,
        deadLetterCount: deadLetterEntries.length,
        stuckProcessingCount: stuckQueueEntries.length,
      },
      imports: {
        lastSuccessfulImportAt: lastSuccess?.lastSuccessfulImportAt,
        lastFailedImportAt: lastFailure?.lastFailedImportAt,
        lastSuccessfulSourceId: lastSuccess?.sourceId,
        lastFailedSourceId: lastFailure?.sourceId,
      },
      bootshaus: bootshausStatus
        ? {
            sourceId: bootshausStatus.sourceId,
            schedulePolicy: bootshausStatus.schedulePolicy,
            scheduleEnabled: bootshausStatus.scheduleEnabled,
            nextScheduledAt: bootshausStatus.nextScheduledAt,
            lastSuccessfulImportAt: bootshausStatus.lastSuccessfulImportAt,
            lastFailedImportAt: bootshausStatus.lastFailedImportAt,
            consecutiveFailures: bootshausStatus.consecutiveFailures,
            currentlyRunning: bootshausStatus.currentlyRunning,
            queuedJobs: bootshausStatus.queuedJobs,
            lastSchedulerError: bootshausStatus.lastSchedulerError,
          }
        : undefined,
      platform: {
        globalMaintenanceMode: opsState.globalMaintenanceMode,
      },
      review: {
        pendingCount: pendingReviews.length,
      },
      matching: {
        pendingMergeCandidates: pendingMerges.length,
      },
      lifecycle: {
        recentHistoryCount: recentLifecycle.length,
      },
      recovery: {
        latestRuns: latestRecoveryRuns,
        stuckQueueCount: stuckQueueEntries.length,
      },
      connector: {
        latestSnapshots: connectorSnapshots,
      },
      backfill: {
        recentJobs: recentBackfillJobs,
      },
    };
  }
}
