import { describe, expect, it } from 'vitest';

import type { SourceRecord } from '@/data/types/records';
import { EventLifecycleEngine } from '@/features/event-lifecycle/services/event-lifecycle-engine';
import { EventLifecycleChangeDetector } from '@/features/event-lifecycle/services/event-lifecycle-change-detector';
import { EventLifecycleDecisionEngine } from '@/features/event-lifecycle/services/event-lifecycle-decision-engine';
import { InMemoryEventLifecycleHistoryRepository } from '@/features/event-lifecycle/repositories/in-memory-lifecycle-repositories';
import { InMemoryEventLifecycleChangeRepository } from '@/features/event-lifecycle/repositories/in-memory-lifecycle-repositories';
import { ImportJobQueueProcessor } from '@/features/import/scheduling/import-job-queue-processor';
import { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import { DefaultImportScheduleService } from '@/features/import/scheduling/import-schedule-service';
import {
  InMemoryImportJobQueueRepository,
  InMemoryWorkerRunRepository,
} from '@/features/import/scheduling/in-memory-scheduler-repositories';
import { InMemorySourceBackedImportScheduleRepository } from '@/features/import/scheduling/source-import-schedule-repository';
import { applyScheduleIntervalPresetToSource } from '@/features/import/scheduling/source-schedule-mapper';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { WorkerRecoveryService } from '@/features/operations/services/worker-recovery-service';
import { ConnectorHealthPersistenceService } from '@/features/operations/services/connector-health-persistence-service';
import { BackfillRunner } from '@/features/operations/backfill/backfill-runner';
import {
  createLifecycleHistoryBackfillHandler,
  createProvenanceBackfillHandler,
} from '@/features/operations/backfill/backfill-handlers';
import {
  InMemoryConnectorHealthSnapshotRepository,
  InMemoryOperationsBackfillJobRepository,
  InMemoryPlatformOperationsStateRepository,
  InMemoryWorkerRecoveryRunRepository,
} from '@/features/operations/repositories/in-memory-operations-repositories';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { SourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import type { AdminEventRecord } from '@/data/types/records';

function createRecoveryStack() {
  const queueRepository = new InMemoryImportJobQueueRepository();
  const queueService = new ImportJobQueueService(queueRepository);
  const scheduleRepository = new InMemorySourceBackedImportScheduleRepository(new Map());
  const workerRunRepository = new InMemoryWorkerRunRepository();
  const recoveryRunRepository = new InMemoryWorkerRecoveryRunRepository();

  const recoveryService = new WorkerRecoveryService(
    queueService,
    scheduleRepository,
    workerRunRepository,
    recoveryRunRepository,
  );

  return { queueService, queueRepository, recoveryService, recoveryRunRepository, workerRunRepository };
}

describe('Sprint 20 platform resilience', () => {
  it('recovers stuck processing queue entries via requeue', async () => {
    const stack = createRecoveryStack();
    const staleStartedAt = new Date(Date.now() - 60 * 60_000).toISOString();
    await stack.queueRepository.enqueue({
      id: 'queue-stuck-1',
      sourceId: 'src-1',
      importJobId: 'job-1',
      priority: 50,
      status: 'processing',
      scheduledFor: staleStartedAt,
      enqueuedAt: staleStartedAt,
      startedAt: staleStartedAt,
      processingLeaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
      triggerType: 'scheduled',
      attemptCount: 0,
      maxAttempts: 3,
    });

    const result = await stack.recoveryService.runRecovery();
    expect(result.run.stuckQueueEntries).toBe(1);
    expect(result.run.recoveredQueueEntries).toBe(1);
    expect(result.run.status).toBe('completed');
  });

  it('dead-letters stuck entries after max attempts', async () => {
    const stack = createRecoveryStack();
    const staleStartedAt = new Date(Date.now() - 60 * 60_000).toISOString();
    await stack.queueRepository.enqueue({
      id: 'queue-stuck-2',
      sourceId: 'src-1',
      importJobId: 'job-2',
      priority: 50,
      status: 'processing',
      scheduledFor: staleStartedAt,
      enqueuedAt: staleStartedAt,
      startedAt: staleStartedAt,
      processingLeaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
      triggerType: 'scheduled',
      attemptCount: 2,
      maxAttempts: 3,
    });

    const result = await stack.recoveryService.runRecovery();
    expect(result.run.deadLetteredQueueEntries).toBe(1);
  });

  it('reconciles stale worker runs', async () => {
    const stack = createRecoveryStack();
    await stack.workerRunRepository.create({
      id: 'worker-stale',
      startedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      status: 'running',
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      jobsRequeued: 0,
      jobsDeadLettered: 0,
    });

    const result = await stack.recoveryService.runRecovery();
    expect(result.run.staleWorkerRunsReconciled).toBe(1);
  });

  it('persists connector health snapshots from registry', async () => {
    const repository = new InMemoryConnectorHealthSnapshotRepository();
    const service = new ConnectorHealthPersistenceService(repository);
    const registry = new SourceConnectorRegistry([]);
    const snapshots = await service.persistFromRegistry(registry);
    expect(snapshots.length).toBe(0);
  });

  it('backfills lifecycle history idempotently', async () => {
    const events: AdminEventRecord[] = [
      {
        id: 'event-1',
        title: 'Test Event',
        description: 'Desc',
        startDate: '2026-08-01T20:00:00.000Z',
        status: 'published',
        sourceId: 'src-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const historyRepository = new InMemoryEventLifecycleHistoryRepository();
    const changeRepository = new InMemoryEventLifecycleChangeRepository();
    const lifecycleEngine = new EventLifecycleEngine(
      new EventLifecycleChangeDetector(),
      new EventLifecycleDecisionEngine(),
      historyRepository,
      changeRepository,
    );
    const eventRepository = {
      async list() {
        return { items: events, total: 1, page: 1, pageSize: 10 };
      },
    };

    const runner = new BackfillRunner(new InMemoryOperationsBackfillJobRepository(), [
      createLifecycleHistoryBackfillHandler(
        eventRepository as never,
        lifecycleEngine,
        historyRepository,
      ),
    ]);

    const job = await runner.start('lifecycle_history', 10);
    const result = await runner.runBatch(job.id);
    expect(result.processedCount).toBe(1);

    const history = await historyRepository.listByCanonicalEventId('event-1');
    expect(history.length).toBe(1);
    expect(history[0]?.lifecycleEventType).toBe('event_created');

    const secondJob = await runner.start('lifecycle_history', 10);
    const rerun = await runner.runBatch(secondJob.id);
    expect(rerun.processedCount).toBe(0);
  });

  it('backfills provenance for events with source', async () => {
    const events: AdminEventRecord[] = [
      {
        id: 'event-2',
        title: 'Provenance Event',
        description: 'With venue info',
        startDate: '2026-08-01T20:00:00.000Z',
        status: 'published',
        sourceId: 'src-1',
        venueName: 'Club',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const multiSource = new InMemoryMultiSourceRepositories();
    const provenanceWriter = new EventFieldProvenanceWriter(multiSource.fieldProvenance);
    const eventRepository = {
      async list() {
        return { items: events, total: 1, page: 1, pageSize: 10 };
      },
    };

    const runner = new BackfillRunner(new InMemoryOperationsBackfillJobRepository(), [
      createProvenanceBackfillHandler(
        eventRepository as never,
        multiSource.sourceReferences,
        provenanceWriter,
      ),
    ]);

    const job = await runner.start('provenance', 10);
    const result = await runner.runBatch(job.id);
    expect(result.processedCount).toBe(1);

    const refs = await multiSource.sourceReferences.findByCanonicalEventId('event-2');
    expect(refs.length).toBe(1);
  });
});
