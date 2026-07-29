import { describe, expect, it, vi } from 'vitest';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import { upsertImportRecordsBySourceExternal } from '@/data/datasources/import-record-upsert';
import type { ImportRecord } from '@/features/import/models/types';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import {
  InMemoryImportReviewQueueRepository,
  InMemoryTrustQualityRuleRepository,
} from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import { ImportRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { TrustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';
import { SourceTrustEngine } from '@/features/trust-quality/services/source-trust-engine';
import { IMPORT_REVIEW_RESOLUTION_REASONS } from '@/features/trust-quality/domain/trust-quality-types';
import type { MultiSourceMatchEvaluation } from '@/features/multi-source-matching/domain/matching-types';
import type { EventLifecycleEvaluation } from '@/features/event-lifecycle/domain/lifecycle-engine-types';
import {
  isSemanticPayloadUnchanged,
  isStablePublishedMatchReimport,
  isStablePublishedTrustReimport,
} from '@/features/import/services/published-reimport-reconciliation';

const SOURCE_A = 'source-a';
const SOURCE_B = 'source-b';

function createSource(id: string, overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id,
    slug: id,
    displayName: id,
    sourceType: 'website',
    parserType: 'html',
    acquisitionStrategy: 'scheduled',
    priority: 50,
    trustScore: 80,
    computedTrustScore: 80,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    publishMode: 'auto_publish',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createHighQualityPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Techno Night',
    description: 'A full night of techno.',
    startDate: '2026-08-01T22:00:00.000Z',
    endDate: '2026-08-02T04:00:00.000Z',
    venueName: 'Warehouse',
    cityName: 'Cologne',
    countryCode: 'DE',
    latitude: 50.9375,
    longitude: 6.9603,
    organizerName: 'ER Crew',
    imageUrl: 'https://example.com/poster.jpg',
    ticketUrl: 'https://example.com/tickets',
    eventUrl: 'https://example.com/event',
    artistNames: ['DJ Test'],
    genreNames: ['Techno'],
    ...overrides,
  };
}

function createPublishedEvent(id: string, payload = createHighQualityPayload()): AdminEventRecord {
  return {
    id,
    canonicalEventId: id,
    title: payload.title as string,
    description: payload.description as string,
    startDate: payload.startDate as string,
    endDate: payload.endDate as string,
    venueName: payload.venueName as string,
    venueCity: payload.cityName as string,
    ticketUrl: payload.ticketUrl as string,
    imageUrl: payload.imageUrl as string,
    organizerName: payload.organizerName as string,
    websiteUrl: payload.eventUrl as string,
    status: 'published',
    sourceId: SOURCE_A,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createRecord(
  sourceId: string,
  id: string,
  externalId: string,
  jobId: string,
  payload = createHighQualityPayload(),
  overrides: Partial<ImportRecord> = {},
): ImportRecord {
  return {
    id,
    importJobId: jobId,
    sourceId,
    externalId,
    rawPayload: {},
    normalizedPayload: payload,
    status: 'needs_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createStack(options: { publishImpl?: ImportEventPublishService['publishRecord'] } = {}) {
  const bundle = createLocalImportDatasourceBundle();
  const reviewRepository = new InMemoryImportReviewQueueRepository();
  const reviewQueueService = new ImportReviewQueueService(reviewRepository);
  const ruleRepository = new InMemoryTrustQualityRuleRepository();
  const decisionEngine = new TrustPublishDecisionEngine(
    new ImportRecordQualityEvaluator(),
    new SourceTrustEngine(),
  );
  const publishDecision = new PublishDecisionService(decisionEngine, ruleRepository);
  const multiSource = new InMemoryMultiSourceRepositories();
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

  const publishService = new ImportEventPublishService(
    bundle.importRecords,
    adminEventRepository,
    multiSource.sourceReferences,
  );
  if (options.publishImpl) {
    publishService.publishRecord = options.publishImpl;
  }

  const orchestrator = new ImportPublishOrchestratorService(
    bundle.importRecords,
    publishService,
    publishDecision,
    undefined,
    reviewQueueService,
    undefined,
    undefined,
    adminEventRepository,
  );

  return {
    bundle,
    reviewRepository,
    reviewQueueService,
    orchestrator,
    publishService,
    adminEvents,
    multiSource,
    publishDecision,
    adminEventRepository,
  };
}

async function seedPublishedRecord(
  stack: ReturnType<typeof createStack>,
  source: SourceRecord,
  eventId: string,
  externalId: string,
  payload = createHighQualityPayload(),
) {
  const event = createPublishedEvent(eventId, payload);
  await stack.adminEventRepository.save(event);
  const record = createRecord(source.id, `rec-${externalId}`, externalId, 'job-seed', payload, {
    status: 'imported',
    resultingEventId: eventId,
  });
  const created = await stack.bundle.importRecords.create({
    ...record,
    importJobId: 'job-seed',
    sourceId: source.id,
    externalId,
    rawPayload: {},
    normalizedPayload: payload,
    status: 'imported',
  });
  await stack.bundle.importRecords.update({
    ...created,
    status: 'imported',
    resultingEventId: eventId,
  });
  await stack.multiSource.sourceReferences.upsert({
    id: `ref-${eventId}`,
    canonicalEventId: eventId,
    sourceId: source.id,
    externalEventId: externalId,
    active: true,
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: '2026-01-01T00:00:00.000Z',
    sourcePriority: 50,
    sourceQuality: 80,
  });
  return { event, record };
}

describe('Sprint 26.9.2 stable published reimport reconciliation', () => {
  it('published + identical payload keeps state stable without review or publish', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const publishSpy = vi.spyOn(stack.publishService, 'publishRecord');
    await seedPublishedRecord(stack, source, 'evt-1', 'ext-1');

    await upsertImportRecordsBySourceExternal(
      [
        {
          importJobId: 'job-2',
          sourceId: SOURCE_A,
          externalId: 'ext-1',
          rawPayload: {},
          normalizedPayload: createHighQualityPayload(),
          status: 'needs_review',
        },
      ],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );

    const result = await stack.orchestrator.processJobRecords('job-2', source, [], 'tester');
    expect(result.publishedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(publishSpy).not.toHaveBeenCalled();
    expect(await stack.reviewQueueService.listPending()).toHaveLength(0);
    const stored = await stack.bundle.importRecords.findLatestBySourceAndExternalId(SOURCE_A, 'ext-1');
    expect(stored?.status).toBe('imported');
    expect(stored?.resultingEventId).toBe('evt-1');
  });

  it('published + technical payload metadata change without semantic delta stays stable', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const payload = createHighQualityPayload();
    const { record } = await seedPublishedRecord(stack, source, 'evt-tech', 'ext-tech', payload);
    const technicalPayload = {
      ...payload,
      fetchedAt: '2026-07-29T10:00:00.000Z',
      sourceMetadata: { runId: 'cron-2' },
    };
    const changedRecord = { ...record, normalizedPayload: technicalPayload };
    expect(isSemanticPayloadUnchanged(changedRecord, createPublishedEvent('evt-tech', payload))).toBe(true);
  });

  it('published + quality improvement does not create an active review', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const improvedPayload = createHighQualityPayload({
      description: 'A full night of techno with extended afterhours.',
    });
    await seedPublishedRecord(stack, source, 'evt-quality', 'ext-quality', createHighQualityPayload());

    await upsertImportRecordsBySourceExternal(
      [
        {
          importJobId: 'job-quality',
          sourceId: SOURCE_A,
          externalId: 'ext-quality',
          rawPayload: {},
          normalizedPayload: improvedPayload,
          status: 'needs_review',
        },
      ],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );

    const publishSpy = vi.spyOn(stack.publishService, 'publishRecord');
    const result = await stack.orchestrator.processJobRecords('job-quality', source, [], 'tester');
    expect(result.publishedCount).toBe(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(await stack.reviewQueueService.listPending()).toHaveLength(0);
  });

  it('published + trust improvement does not create an active review', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A, { trustScore: 85, computedTrustScore: 85 });
    await seedPublishedRecord(stack, source, 'evt-trust', 'ext-trust');
    const records = await stack.bundle.importRecords.listByJobId('job-seed');
    const evaluation = await stack.publishDecision.evaluate({ source, record: records[0]! });
    expect(isStablePublishedTrustReimport(records[0]!, evaluation!, {
      existingEvent: createPublishedEvent('evt-trust'),
    })).toBe(true);
  });

  it('published + relevant date change still publishes update without duplicate', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    await seedPublishedRecord(stack, source, 'evt-date', 'ext-date');
    const changedPayload = createHighQualityPayload({ startDate: '2026-09-01T22:00:00.000Z' });

    await upsertImportRecordsBySourceExternal(
      [
        {
          importJobId: 'job-date',
          sourceId: SOURCE_A,
          externalId: 'ext-date',
          rawPayload: {},
          normalizedPayload: changedPayload,
          status: 'needs_review',
        },
      ],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );

    const result = await stack.orchestrator.processJobRecords('job-date', source, [], 'tester');
    expect(result.publishedCount).toBe(1);
    expect(stack.adminEvents).toHaveLength(1);
    expect(stack.adminEvents[0]?.startDate).toBe('2026-09-01T22:00:00.000Z');
  });

  it('published + venue conflict creates or updates an active review', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const record = createRecord(SOURCE_A, 'rec-venue', 'ext-venue', 'job-venue', createHighQualityPayload(), {
      status: 'imported',
      resultingEventId: 'evt-venue',
    });
    const evaluation = {
      id: 'match-venue',
      importRecordId: record.id,
      sourceId: SOURCE_A,
      externalEventId: record.externalId,
      canonicalEventId: 'evt-venue',
      confidenceScore: 88,
      confidenceTier: 'probable',
      decision: 'review_required' as const,
      reasons: ['Venue mismatch detected.'],
      fieldDifferences: [
        {
          field: 'venueName',
          incomingValue: 'Other Venue',
          canonicalValue: 'Warehouse',
          severity: 'critical' as const,
        },
      ],
      signals: [],
      involvedSourceIds: [SOURCE_A],
      fingerprintSnapshot: {},
      createdAt: new Date().toISOString(),
    } satisfies MultiSourceMatchEvaluation;

    expect(
      isStablePublishedMatchReimport(record, evaluation, {
        existingEvent: createPublishedEvent('evt-venue'),
      }),
    ).toBe(false);

    const created = await stack.reviewQueueService.enqueueFromMatchEvaluation(
      record,
      source,
      evaluation,
      'job-venue',
      createPublishedEvent('evt-venue'),
    );
    expect(created?.status).toBe('pending');
    expect(await stack.reviewQueueService.listPending()).toHaveLength(1);
  });

  it('published + blocking violation creates an active review', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A, { trustScore: 40, computedTrustScore: 40 });
    const record = createRecord(SOURCE_A, 'rec-block', 'ext-block', 'job-block', createHighQualityPayload(), {
      status: 'needs_review',
      resultingEventId: 'evt-block',
    });
    const evaluation = await stack.publishDecision.evaluate({ source, record });
    expect(['hold', 'reject']).toContain(evaluation?.decision);
    expect(
      isStablePublishedTrustReimport(record, evaluation!, { existingEvent: createPublishedEvent('evt-block') }),
    ).toBe(false);
  });

  it('publish failure remains visible with controlled review state', async () => {
    const stack = createStack({
      publishImpl: async () => {
        throw new Error('canonical venue missing');
      },
    });
    const source = createSource(SOURCE_A);
    await seedPublishedRecord(stack, source, 'evt-fail', 'ext-fail');
    const changedPayload = createHighQualityPayload({ title: 'Changed title' });
    await upsertImportRecordsBySourceExternal(
      [
        {
          importJobId: 'job-fail',
          sourceId: SOURCE_A,
          externalId: 'ext-fail',
          rawPayload: {},
          normalizedPayload: changedPayload,
          status: 'needs_review',
        },
      ],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );

    const result = await stack.orchestrator.processJobRecords('job-fail', source, [], 'tester');
    expect(result.queuedCount).toBe(1);
    const pending = await stack.reviewQueueService.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.metadata?.publishError).toBe('canonical venue missing');
  });

  it('trust and lifecycle enqueue paths keep at most one active review on stable reimport', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const record = createRecord(SOURCE_A, 'rec-dedup', 'ext-dedup', 'job-dedup', createHighQualityPayload(), {
      status: 'imported',
      resultingEventId: 'evt-dedup',
    });
    const existingEvent = createPublishedEvent('evt-dedup');
    const matchEvaluation: MultiSourceMatchEvaluation = {
      id: 'match-dedup',
      importRecordId: record.id,
      sourceId: SOURCE_A,
      externalEventId: record.externalId,
      canonicalEventId: 'evt-dedup',
      confidenceScore: 97,
      confidenceTier: 'certain',
      decision: 'review_required',
      reasons: ['Field differences detected (1); downgrading to review.'],
      fieldDifferences: [
        {
          field: 'description',
          incomingValue: 'A full night of techno.',
          canonicalValue: 'A full night of techno.',
          severity: 'info',
        },
      ],
      signals: [],
      involvedSourceIds: [SOURCE_A],
      fingerprintSnapshot: {},
      createdAt: new Date().toISOString(),
    };
    const lifecycleEvaluation: EventLifecycleEvaluation = {
      id: 'life-dedup',
      canonicalEventId: 'evt-dedup',
      lifecycleEventType: 'event_updated',
      decision: 'review_required',
      changes: [],
      confidenceScore: 80,
      reasons: ['No material lifecycle change.'],
      sourceId: SOURCE_A,
      importRecordId: record.id,
      createdAt: new Date().toISOString(),
    };

    await stack.reviewQueueService.enqueueFromMatchEvaluation(
      record,
      source,
      matchEvaluation,
      'job-dedup',
      existingEvent,
    );
    await stack.reviewQueueService.enqueueFromLifecycleEvaluation(
      record,
      source,
      lifecycleEvaluation,
      'job-dedup',
      existingEvent,
    );
    expect(await stack.reviewQueueService.listPending()).toHaveLength(0);
  });

  it('second and third identical cron reimport stay idempotent', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    await seedPublishedRecord(stack, source, 'evt-idem', 'ext-idem');
    const input = {
      importJobId: 'job-idem-1',
      sourceId: SOURCE_A,
      externalId: 'ext-idem',
      rawPayload: {},
      normalizedPayload: createHighQualityPayload(),
      status: 'needs_review' as const,
    };
    const deps = {
      findLatest: (sourceId: string, externalId: string) =>
        stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
      create: (value: Parameters<typeof stack.bundle.importRecords.create>[0]) =>
        stack.bundle.importRecords.create(value),
      update: (value: ImportRecord) => stack.bundle.importRecords.update(value),
    };

    await upsertImportRecordsBySourceExternal([input], deps);
    await stack.orchestrator.processJobRecords('job-idem-1', source, [], 'tester');

    for (const jobId of ['job-idem-2', 'job-idem-3']) {
      await upsertImportRecordsBySourceExternal([{ ...input, importJobId: jobId }], deps);
      const result = await stack.orchestrator.processJobRecords(jobId, source, [], 'tester');
      expect(result.publishedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(await stack.reviewQueueService.listPending()).toHaveLength(0);
      expect(stack.adminEvents).toHaveLength(1);
      expect((await stack.multiSource.sourceReferences.findBySourceId(SOURCE_A)).length).toBe(1);
    }
  });

  it('applies identical behavior for a second generic source', async () => {
    const stack = createStack();
    const sourceB = createSource(SOURCE_B);
    await seedPublishedRecord(stack, sourceB, 'evt-b', 'ext-b');
    await upsertImportRecordsBySourceExternal(
      [
        {
          importJobId: 'job-b',
          sourceId: SOURCE_B,
          externalId: 'ext-b',
          rawPayload: {},
          normalizedPayload: createHighQualityPayload(),
          status: 'needs_review',
        },
      ],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );
    const result = await stack.orchestrator.processJobRecords('job-b', sourceB, [], 'tester');
    expect(result.skippedCount).toBe(1);
    expect(await stack.reviewQueueService.listPending()).toHaveLength(0);
  });
});
