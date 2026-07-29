import { describe, expect, it } from 'vitest';

import type { SourceRecord } from '@/data/types/records';
import { ImportJobQueueProcessor } from '@/features/import/scheduling/import-job-queue-processor';
import { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import { ImportSchedulerEngine } from '@/features/import/scheduling/import-scheduler-engine';
import { DefaultImportScheduleService } from '@/features/import/scheduling/import-schedule-service';
import {
  InMemoryImportJobQueueRepository,
  InMemorySchedulerRunRepository,
  InMemoryWorkerRunRepository,
} from '@/features/import/scheduling/in-memory-scheduler-repositories';
import { InMemorySourceBackedImportScheduleRepository } from '@/features/import/scheduling/source-import-schedule-repository';
import { applyScheduleIntervalPresetToSource } from '@/features/import/scheduling/source-schedule-mapper';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { ImportJobQueueWorker } from '@/features/operations/services/import-job-queue-worker';
import {
  OperationsControlService,
  OperationsTriggerService,
} from '@/features/operations/services/operations-control-service';
import { SourceIntelligenceService } from '@/features/operations/services/source-intelligence-service';
import { ProductionOperationsMonitoringService } from '@/features/operations/services/production-operations-monitoring-service';
import { BackfillRunner } from '@/features/operations/backfill/backfill-runner';
import { createSourceIntelligenceBackfillHandler } from '@/features/operations/backfill/backfill-handlers';
import {
  InMemoryOperationsBackfillJobRepository,
  InMemoryPlatformOperationsStateRepository,
  InMemorySourceIntelligenceSnapshotRepository,
} from '@/features/operations/repositories/in-memory-operations-repositories';
import { InMemoryImportReviewQueueRepository } from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import { InMemoryEventMatchEvaluationRepository } from '@/features/multi-source-matching/repositories/in-memory-matching-repositories';
import { InMemoryEventLifecycleHistoryRepository } from '@/features/event-lifecycle/repositories/in-memory-lifecycle-repositories';
import { InMemoryEventMergeCandidateRepository } from '@/features/multi-source-matching/repositories/in-memory-matching-repositories';
import { ImportSchedulerMonitoringService } from '@/features/import/scheduling/import-scheduler-monitoring';

function createOpsStack() {
  const sources = new Map<string, SourceRecord>();
  const bootshaus = applyScheduleIntervalPresetToSource(
    createBootshausProductionSourceRecord(),
    'hourly',
  );
  sources.set(bootshaus.id, {
    ...bootshaus,
    totalImportCount: 10,
    errorRate: 0.1,
    averageDurationMs: 5000,
    lastSuccessfulSyncAt: '2026-07-15T08:00:00.000Z',
  });

  const scheduleRepository = new InMemorySourceBackedImportScheduleRepository(sources);
  const scheduleService = new DefaultImportScheduleService(scheduleRepository);
  const queueRepository = new InMemoryImportJobQueueRepository();
  const schedulerRunRepository = new InMemorySchedulerRunRepository();
  const workerRunRepository = new InMemoryWorkerRunRepository();
  const opsStateRepository = new InMemoryPlatformOperationsStateRepository();
  const queueService = new ImportJobQueueService(queueRepository);

  const adminSourceRepository = {
    async getById(id: string) {
      return sources.get(id) ?? null;
    },
    async list() {
      return { items: [...sources.values()], total: sources.size, page: 1, pageSize: 50 };
    },
    async save(source: SourceRecord) {
      sources.set(source.id, source);
      return source;
    },
  };

  const queueProcessor = {
    async processReadyJobs() {
      return { processed: 0, succeeded: 0, failed: 0, requeued: 0, deadLettered: 0, results: [] };
    },
  } as unknown as ImportJobQueueProcessor;

  const schedulerEngine = new ImportSchedulerEngine(
    scheduleService,
    scheduleRepository,
    schedulerRunRepository,
    queueService,
    queueProcessor,
    {} as never,
    { getActiveJobForSource: async () => null } as never,
    { info: async () => {}, error: async () => {} } as never,
    async (sourceId) => sources.get(sourceId) ?? null,
    () => true,
  );

  const worker = new ImportJobQueueWorker(queueProcessor, workerRunRepository, opsStateRepository);
  const controlService = new OperationsControlService(opsStateRepository, queueService);
  const triggerService = new OperationsTriggerService(
    schedulerEngine,
    worker,
    opsStateRepository,
    controlService,
  );
  const intelligenceService = new SourceIntelligenceService(
    adminSourceRepository as never,
    new InMemorySourceIntelligenceSnapshotRepository(),
    scheduleRepository,
    queueRepository,
    new InMemoryImportReviewQueueRepository(),
    new InMemoryEventMatchEvaluationRepository(),
    new InMemoryEventLifecycleHistoryRepository(),
  );
    const monitoringService = new ProductionOperationsMonitoringService(
      new ImportSchedulerMonitoringService(
        scheduleRepository,
        schedulerRunRepository,
        queueRepository,
        async () => false,
      ),
      workerRunRepository,
      opsStateRepository,
      queueRepository,
      new InMemoryImportReviewQueueRepository(),
      new InMemoryEventMergeCandidateRepository(),
      new InMemoryEventLifecycleHistoryRepository(),
      undefined,
      undefined,
      undefined,
      queueService,
    );
  const backfillRepository = new InMemoryOperationsBackfillJobRepository();
  const backfillRunner = new BackfillRunner(backfillRepository, [
    createSourceIntelligenceBackfillHandler(intelligenceService),
  ]);

  return {
    bootshaus,
    triggerService,
    controlService,
    intelligenceService,
    monitoringService,
    backfillRunner,
    opsStateRepository,
  };
}

describe('Sprint 19 production operations', () => {
  it('separates scheduler tick from queue worker processing', async () => {
    const stack = createOpsStack();
    const schedulerResult = await stack.triggerService.triggerScheduler({
      triggerType: 'cron',
      processQueue: false,
    });
    expect(schedulerResult).toBeDefined();
    if ('skipped' in schedulerResult) {
      expect(schedulerResult.skipped).toBe(false);
    } else {
      expect(schedulerResult.processorResult).toBeNull();
    }

    const workerResult = await stack.triggerService.triggerWorker({ triggerType: 'cron' });
    expect(workerResult.run.status).toBe('completed');
  });

  it('pauses and resumes worker', async () => {
    const stack = createOpsStack();
    await stack.controlService.pauseWorker();
    const pausedResult = await stack.triggerService.triggerWorker({ triggerType: 'manual' });
    expect(pausedResult.run.status).toBe('skipped');

    await stack.controlService.resumeWorker();
    const resumedResult = await stack.triggerService.triggerWorker({ triggerType: 'manual' });
    expect(resumedResult.run.status).toBe('completed');
  });

  it('computes source intelligence metrics', async () => {
    const stack = createOpsStack();
    const snapshot = await stack.intelligenceService.computeForSource(stack.bootshaus.id);
    expect(snapshot.sourceId).toBe(stack.bootshaus.id);
    expect(snapshot.availabilityScore).toBeGreaterThan(0);
    expect(snapshot.successRate).toBe(90);
    expect(snapshot.errorRate).toBe(10);
  });

  it('provides production monitoring snapshot', async () => {
    const stack = createOpsStack();
    const snapshot = await stack.monitoringService.getSnapshot();
    expect(snapshot.scheduler).toBeDefined();
    expect(snapshot.worker).toBeDefined();
    expect(snapshot.queue).toBeDefined();
    expect(snapshot.imports).toBeDefined();
    expect(snapshot.bootshaus).toBeDefined();
    expect(snapshot.review).toBeDefined();
    expect(snapshot.matching).toBeDefined();
    expect(snapshot.lifecycle).toBeDefined();
    expect(snapshot.recovery).toBeDefined();
    expect(snapshot.connector).toBeDefined();
    expect(snapshot.backfill).toBeDefined();
    expect(snapshot.queue.queuedCount).toBeGreaterThanOrEqual(0);
    expect(snapshot.worker.processingJobCount).toBeGreaterThanOrEqual(0);
  });

  it('prevents duplicate active backfill jobs', async () => {
    const stack = createOpsStack();
    const job = await stack.backfillRunner.start('source_intelligence', 10);
    const duplicate = await stack.backfillRunner.start('source_intelligence', 10);
    expect(duplicate.id).toBe(job.id);

    const result = await stack.backfillRunner.runBatch(job.id);
    expect(result.status).toBe('completed');
    expect(result.processedCount).toBeGreaterThan(0);
  });

  it('supports global maintenance mode', async () => {
    const stack = createOpsStack();
    await stack.controlService.setGlobalMaintenanceMode(true);
    const schedulerResult = await stack.triggerService.triggerScheduler({ triggerType: 'manual' });
    expect(schedulerResult).toEqual({
      skipped: true,
      reason: 'global_maintenance_mode',
    });
  });
});
