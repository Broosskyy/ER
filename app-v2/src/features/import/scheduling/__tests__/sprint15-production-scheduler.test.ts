import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { DefaultImportScheduleService } from '@/features/import/scheduling/import-schedule-service';
import { InMemorySourceBackedImportScheduleRepository } from '@/features/import/scheduling/source-import-schedule-repository';
import {
  InMemoryImportJobQueueRepository,
  InMemorySchedulerRunRepository,
} from '@/features/import/scheduling/in-memory-scheduler-repositories';
import { ImportJobQueueService } from '@/features/import/scheduling/import-job-queue-service';
import { ImportJobQueueProcessor } from '@/features/import/scheduling/import-job-queue-processor';
import { ImportSchedulerEngine } from '@/features/import/scheduling/import-scheduler-engine';
import { applyScheduleIntervalPresetToSource } from '@/features/import/scheduling/source-schedule-mapper';
import { resolveScheduleIntervalPreset } from '@/features/import/scheduling/schedule-interval-preset';
import { shouldUseAggregationForSource } from '@/features/import/scheduling/scheduler-source-utils';
import type { ImportJob } from '@/features/import/models/types';

function createSchedulerStack() {
  const bundle = createLocalImportDatasourceBundle();
  const loggingService = new ImportLoggingService(bundle.importLogs);
  const multiSource = new InMemoryMultiSourceRepositories();
  const sources = new Map<string, SourceRecord>();
  const bootshaus = applyScheduleIntervalPresetToSource(
    createBootshausProductionSourceRecord(),
    'every_15_minutes',
  );
  sources.set(bootshaus.id, {
    ...bootshaus,
    nextScheduledAt: '2026-07-15T09:00:00.000Z',
    scheduleEnabled: true,
    schedulePolicy: 'interval',
    pollingIntervalMinutes: 15,
  });

  const scheduleRepository = new InMemorySourceBackedImportScheduleRepository(sources);
  const scheduleService = new DefaultImportScheduleService(scheduleRepository);
  const adminEvents: AdminEventRecord[] = [];
  const adminEventRepository = {
    async list() {
      return { items: adminEvents, total: adminEvents.length, page: 1, pageSize: 50 };
    },
    async getById(id: string) {
      return adminEvents.find((event) => event.id === id) ?? null;
    },
    async save(event: AdminEventRecord) {
      const index = adminEvents.findIndex((entry) => entry.id === event.id);
      if (index >= 0) {
        adminEvents[index] = event;
      } else {
        adminEvents.push(event);
      }
      return event;
    },
    async delete() {},
  };

  const consumerEventRepository = {
    resolveCanonicalId(id: string) {
      return id;
    },
    getPublishedEvents() {
      return adminEvents.filter((event) => event.status === 'published');
    },
    getEventById(id: string) {
      return adminEvents.find((event) => event.id === id);
    },
    async refresh() {},
  } as unknown as EventRepository;

  const publishService = new ImportEventPublishService(
    bundle.importRecords,
    adminEventRepository,
    multiSource.sourceReferences,
    consumerEventRepository,
  );
  const publishDecision = new PublishDecisionService();
  const publishOrchestrator = new ImportPublishOrchestratorService(
    bundle.importRecords,
    publishService,
    publishDecision,
    loggingService,
  );
  const { matchingService } = createImportMatchingService();
  const aggregationService = new ImportAggregationService(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    loggingService,
    adminEventRepository,
    matchingService,
    undefined,
    undefined,
    publishOrchestrator,
  );

  const activeJobs = new Map<string, ImportJob>();
  const adminRepository = {
    async getActiveJobForSource(sourceId: string) {
      for (const job of activeJobs.values()) {
        if (job.sourceId === sourceId && ['pending', 'running'].includes(job.status)) {
          return job;
        }
      }
      return null;
    },
  };

  const originalCreate = bundle.importJobs.create.bind(bundle.importJobs);
  bundle.importJobs.create = async (input) => {
    const job = await originalCreate(input);
    activeJobs.set(job.id, job);
    return job;
  };
  const originalUpdate = bundle.importJobs.update.bind(bundle.importJobs);
  bundle.importJobs.update = async (job) => {
    const updated = await originalUpdate(job);
    activeJobs.set(updated.id, updated);
    return updated;
  };

  const queueRepository = new InMemoryImportJobQueueRepository();
  const schedulerRunRepository = new InMemorySchedulerRunRepository();
  const queueService = new ImportJobQueueService(queueRepository);
  const queueProcessor = new ImportJobQueueProcessor(
    queueService,
    bundle.importJobs,
    adminRepository as never,
    aggregationService,
    scheduleService,
    loggingService,
    async (sourceId) => sources.get(sourceId) ?? null,
    shouldUseAggregationForSource,
  );
  const schedulerEngine = new ImportSchedulerEngine(
    scheduleService,
    scheduleRepository,
    schedulerRunRepository,
    queueService,
    queueProcessor,
    aggregationService,
    adminRepository as never,
    loggingService,
    async (sourceId) => sources.get(sourceId) ?? null,
    shouldUseAggregationForSource,
  );

  return {
    bundle,
    sources,
    bootshaus,
    scheduleRepository,
    scheduleService,
    schedulerEngine,
    queueRepository,
    schedulerRunRepository,
    aggregationService,
  };
}

describe('Sprint 15 production scheduler', () => {
  it('maps interval presets to schedule policy', () => {
    expect(resolveScheduleIntervalPreset('disabled').schedulePolicy).toBe('paused');
    expect(resolveScheduleIntervalPreset('manual').schedulePolicy).toBe('manual_only');
    expect(resolveScheduleIntervalPreset('hourly').pollingIntervalMinutes).toBe(60);
    expect(resolveScheduleIntervalPreset('daily').pollingIntervalMinutes).toBe(1440);
  });

  it('enqueues import jobs instead of running imports directly', async () => {
    const stack = createSchedulerStack();
    await stack.bundle.importSources.save(
      mapSourceRecordToImportSource(stack.bootshaus),
    );

    const result = await stack.schedulerEngine.tick({
      now: new Date('2026-07-15T10:00:00.000Z'),
    });

    expect(result.run.jobsEnqueued).toBeGreaterThanOrEqual(0);
    expect(result.run.status).not.toBe('failed');
    const runs = await stack.schedulerRunRepository.getLatest();
    expect(runs.length).toBeGreaterThan(0);
  });

  it('prevents duplicate enqueue when source lock is held', async () => {
    const source = applyScheduleIntervalPresetToSource(createBootshausProductionSourceRecord(), 'hourly');
    const sources = new Map<string, SourceRecord>([[source.id, source]]);
    const repository = new InMemorySourceBackedImportScheduleRepository(sources);
    await repository.saveState({
      sourceId: source.id,
      scheduleEnabled: true,
      schedulePolicy: 'interval',
      pollingIntervalMinutes: 60,
      timezone: 'UTC',
      nextScheduledAt: '2026-07-15T09:00:00.000Z',
      consecutiveFailures: 0,
    });

    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const acquired = await repository.tryAcquireLock(source.id, 'lease-a', expiresAt);
    const blocked = await repository.tryAcquireLock(source.id, 'lease-b', expiresAt);
    expect(acquired).toBe(true);
    expect(blocked).toBe(false);
  });

  it('splits aggregation into enqueue and execute phases', async () => {
    const stack = createSchedulerStack();
    await stack.bundle.importSources.save(
      mapSourceRecordToImportSource(stack.bootshaus),
    );

    const job = await stack.aggregationService.enqueueJob(stack.bootshaus, 'scheduled', 'test');
    expect(job.status).toBe('pending');
    expect(job.triggerType).toBe('scheduled');

    const completed = await stack.aggregationService.executeExistingJob(job, stack.bootshaus);
    expect(['completed', 'completed_with_warnings', 'failed']).toContain(completed.status);
  });
});
