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
import type { TrustPublishEvaluation } from '@/features/trust-quality/domain/trust-quality-types';

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

function createRecord(
  sourceId: string,
  id: string,
  externalId: string,
  jobId: string,
  payload = createHighQualityPayload(),
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
  };
}

function buildHoldEvaluation(): TrustPublishEvaluation {
  return {
    decision: 'hold',
    qualityScore: 34,
    trustScore: 76,
    reasons: ['Organizer is missing.'],
    affectedFields: ['organizerName'],
    ruleIds: ['rule-missing-organizer'],
    violations: [],
    quality: {
      score: 34,
      tier: 'D',
      completeness: 48,
      missingFields: ['organizer'],
      blockingIssues: [],
      warnings: [],
      violations: [],
      calculatedAt: new Date().toISOString(),
    },
  };
}

function buildAutoPublishEvaluation(): TrustPublishEvaluation {
  return {
    decision: 'auto_publish',
    qualityScore: 68,
    trustScore: 78,
    reasons: [],
    affectedFields: [],
    ruleIds: [],
    violations: [],
    quality: {
      score: 68,
      tier: 'C',
      completeness: 68,
      missingFields: [],
      blockingIssues: [],
      warnings: [],
      violations: [],
      calculatedAt: new Date().toISOString(),
    },
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
  };
}

describe('Sprint 26.9 trust review reconciliation', () => {
  it('closes stale hold review and publishes once when evaluation improves to auto_publish', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const record = createRecord(SOURCE_A, 'rec-1', 'ext-1', 'job-1');
    await stack.bundle.importRecords.create({
      ...record,
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: record.normalizedPayload,
      status: 'needs_review',
    });

    const stale = await stack.reviewQueueService.enqueueFromEvaluation(
      record,
      source,
      buildHoldEvaluation(),
      'job-0',
    );
    expect(stale?.status).toBe('on_hold');
    expect(stale?.qualityScore).toBe(34);

    const publishSpy = vi.spyOn(stack.publishService, 'publishRecord');
    const result = await stack.orchestrator.processJobRecords('job-1', source, [], 'tester');

    expect(result.publishedCount).toBe(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);

    const pending = await stack.reviewQueueService.listPending();
    expect(pending).toHaveLength(0);

    const allReviews = await stack.reviewRepository.listBySourceId(SOURCE_A);
    expect(allReviews).toHaveLength(1);
    expect(allReviews[0]?.status).toBe('expired');
    expect(allReviews[0]?.metadata?.resolutionReason).toBe(
      IMPORT_REVIEW_RESOLUTION_REASONS.evaluationImprovedToAutoPublish,
    );
  });

  it('updates existing review_required entry without creating a duplicate', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A, { trustScore: 65, computedTrustScore: 65 });
    const record = createRecord(SOURCE_A, 'rec-1', 'ext-1', 'job-1');
    await stack.bundle.importRecords.create({
      ...record,
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: record.normalizedPayload,
      status: 'needs_review',
    });

    const firstEvaluation = await stack.publishDecision.evaluate({ source, record });
    expect(firstEvaluation?.decision).toBe('review_required');
    await stack.reviewQueueService.reconcileFromEvaluation(record, source, firstEvaluation!, 'job-0');
    const secondEvaluation = await stack.publishDecision.evaluate({
      source,
      record: {
        ...record,
        normalizedPayload: {
          ...record.normalizedPayload,
          description: 'Updated description for review.',
        },
      },
    });
    expect(secondEvaluation?.decision).toBe('review_required');
    await stack.reviewQueueService.reconcileFromEvaluation(
      {
        ...record,
        normalizedPayload: {
          ...record.normalizedPayload,
          description: 'Updated description for review.',
        },
      },
      source,
      secondEvaluation!,
      'job-1',
    );

    const pending = await stack.reviewQueueService.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.decision).toBe('review_required');
    expect(pending[0]?.importJobId).toBe('job-0');
  });

  it('closes hold review and publishes when evaluation changes to auto_publish', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const record = createRecord(SOURCE_A, 'rec-1', 'ext-1', 'job-1');
    await stack.bundle.importRecords.create({
      ...record,
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: record.normalizedPayload,
      status: 'needs_review',
    });
    await stack.reviewQueueService.enqueueFromEvaluation(record, source, buildHoldEvaluation(), 'job-0');

    const publishSpy = vi.spyOn(stack.publishService, 'publishRecord');
    const result = await stack.orchestrator.processJobRecords('job-1', source, [], 'tester');

    expect(result.publishedCount).toBe(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect((await stack.reviewQueueService.listPending())).toHaveLength(0);
  });

  it('publishes without creating a review when auto_publish has no existing review', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const record = createRecord(SOURCE_A, 'rec-1', 'ext-1', 'job-1');
    await stack.bundle.importRecords.create({
      ...record,
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: record.normalizedPayload,
      status: 'needs_review',
    });

    const publishSpy = vi.spyOn(stack.publishService, 'publishRecord');
    const result = await stack.orchestrator.processJobRecords('job-1', source, [], 'tester');

    expect(result.publishedCount).toBe(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect((await stack.reviewQueueService.listPending())).toHaveLength(0);
    expect((await stack.reviewRepository.listBySourceId(SOURCE_A))).toHaveLength(0);
  });

  it('surfaces publish failures with a controlled review state', async () => {
    const stack = createStack({
      publishImpl: async () => {
        throw new Error('canonical venue missing');
      },
    });
    const source = createSource(SOURCE_A);
    const record = createRecord(SOURCE_A, 'rec-1', 'ext-1', 'job-1');
    await stack.bundle.importRecords.create({
      ...record,
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: record.normalizedPayload,
      status: 'needs_review',
    });

    const result = await stack.orchestrator.processJobRecords('job-1', source, [], 'tester');
    expect(result.publishedCount).toBe(0);
    expect(result.queuedCount).toBe(1);

    const pending = await stack.reviewQueueService.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.metadata?.publishError).toBe('canonical venue missing');
    expect(pending[0]?.metadata?.resolutionReason).toBe(IMPORT_REVIEW_RESOLUTION_REASONS.publishFailed);

    const stored = (await stack.bundle.importRecords.listByJobId('job-1'))[0];
    expect(stored?.status).toBe('needs_review');
  });

  it('keeps second identical import idempotent without duplicate events or reviews', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const input = {
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: createHighQualityPayload(),
      status: 'needs_review' as const,
    };

    await upsertImportRecordsBySourceExternal([input], {
      findLatest: (sourceId, externalId) =>
        stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
      create: (value) => stack.bundle.importRecords.create(value),
      update: (value) => stack.bundle.importRecords.update(value),
    });

    const first = await stack.orchestrator.processJobRecords('job-1', source, [], 'tester');
    expect(first.publishedCount).toBe(1);

    const beforeRecords = await stack.bundle.importRecords.listByJobId('job-1');
    const beforeEvents = stack.adminEvents.length;
    const beforeRefs = (await stack.multiSource.sourceReferences.findBySourceId(SOURCE_A)).length;

    await upsertImportRecordsBySourceExternal(
      [{ ...input, importJobId: 'job-2', normalizedPayload: createHighQualityPayload() }],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );

    const second = await stack.orchestrator.processJobRecords('job-2', source, beforeRecords, 'tester');
    expect(second.publishedCount).toBe(0);
    expect(second.skippedCount).toBe(1);
    expect(second.queuedCount).toBe(0);
    expect(stack.adminEvents.length).toBe(beforeEvents);
    expect((await stack.multiSource.sourceReferences.findBySourceId(SOURCE_A)).length).toBe(beforeRefs);
    expect((await stack.reviewQueueService.listPending())).toHaveLength(0);
  });

  it('updates published entities on payload change without creating duplicates', async () => {
    const stack = createStack();
    const source = createSource(SOURCE_A);
    const basePayload = createHighQualityPayload();
    const input = {
      importJobId: 'job-1',
      sourceId: SOURCE_A,
      externalId: 'ext-1',
      rawPayload: {},
      normalizedPayload: basePayload,
      status: 'needs_review' as const,
    };

    await upsertImportRecordsBySourceExternal([input], {
      findLatest: (sourceId, externalId) =>
        stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
      create: (value) => stack.bundle.importRecords.create(value),
      update: (value) => stack.bundle.importRecords.update(value),
    });

    await stack.orchestrator.processJobRecords('job-1', source, [], 'tester');
    expect(stack.adminEvents).toHaveLength(1);
    const firstEventId = stack.adminEvents[0]?.id;

    const changedPayload = createHighQualityPayload({ title: 'Updated Techno Night' });
    await upsertImportRecordsBySourceExternal(
      [{ ...input, importJobId: 'job-2', normalizedPayload: changedPayload }],
      {
        findLatest: (sourceId, externalId) =>
          stack.bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
        create: (value) => stack.bundle.importRecords.create(value),
        update: (value) => stack.bundle.importRecords.update(value),
      },
    );

    const changedRecords = await stack.bundle.importRecords.listByJobId('job-2');
    const result = await stack.orchestrator.processJobRecords('job-2', source, changedRecords, 'tester');
    expect(result.publishedCount).toBe(1);
    expect(stack.adminEvents).toHaveLength(1);
    expect(stack.adminEvents[0]?.id).toBe(firstEventId);
    expect(stack.adminEvents[0]?.title).toBe('Updated Techno Night');
  });

  it('closes stale trust reviews on stable published reimport', async () => {
    const repository = new InMemoryImportReviewQueueRepository();
    const service = new ImportReviewQueueService(repository);
    const now = new Date().toISOString();
    const record: ImportRecord = {
      ...createRecord(SOURCE_A, 'rec-stable', 'ext-stable', 'job-stable'),
      status: 'duplicate',
      resultingEventId: 'evt-stable',
    };

    await repository.upsert({
      id: 'review-stable',
      importRecordId: record.id,
      sourceId: SOURCE_A,
      externalEventId: record.externalId,
      status: 'pending',
      decision: 'review_required',
      qualityScore: 58,
      reasons: ['Potential duplicate detected.', 'quality_score_below_auto_publish_threshold'],
      affectedFields: [],
      ruleIds: [],
      createdAt: now,
      updatedAt: now,
    });

    const evaluation: TrustPublishEvaluation = {
      decision: 'review_required',
      qualityScore: 58,
      trustScore: 75,
      reasons: ['Potential duplicate detected.', 'quality_score_below_auto_publish_threshold'],
      affectedFields: [],
      ruleIds: [],
      violations: [],
      quality: {
        score: 58,
        tier: 'C',
        completeness: 90,
        missingFields: [],
        blockingIssues: [],
        warnings: [],
        violations: [],
        calculatedAt: now,
      },
    };

    const result = await service.reconcileFromEvaluation(record, createSource(SOURCE_A), evaluation);
    expect(result.action).toBe('closed');
    expect(result.entry?.metadata?.resolutionReason).toBe(
      IMPORT_REVIEW_RESOLUTION_REASONS.stablePublishedRecordReimport,
    );
  });

  it('applies identical reconciliation behavior for a second source', async () => {
    const stack = createStack();
    const sourceA = createSource(SOURCE_A);
    const sourceB = createSource(SOURCE_B);

    for (const [source, recordId, externalId, jobId] of [
      [sourceA, 'rec-a', 'ext-a', 'job-a'],
      [sourceB, 'rec-b', 'ext-b', 'job-b'],
    ] as const) {
      const record = createRecord(source.id, recordId, externalId, jobId);
      await stack.bundle.importRecords.create({
        ...record,
        importJobId: jobId,
        sourceId: source.id,
        externalId,
        rawPayload: {},
        normalizedPayload: record.normalizedPayload,
        status: 'needs_review',
      });
      await stack.reviewQueueService.enqueueFromEvaluation(record, source, buildHoldEvaluation(), 'job-0');
    }

    const resultA = await stack.orchestrator.processJobRecords('job-a', sourceA, [], 'tester');
    const resultB = await stack.orchestrator.processJobRecords('job-b', sourceB, [], 'tester');

    expect(resultA.publishedCount).toBe(1);
    expect(resultB.publishedCount).toBe(1);
    expect((await stack.reviewQueueService.listPending())).toHaveLength(0);

    for (const sourceId of [SOURCE_A, SOURCE_B]) {
      const reviews = await stack.reviewRepository.listBySourceId(sourceId);
      expect(reviews).toHaveLength(1);
      expect(reviews[0]?.status).toBe('expired');
      expect(reviews[0]?.metadata?.resolutionReason).toBe(
        IMPORT_REVIEW_RESOLUTION_REASONS.evaluationImprovedToAutoPublish,
      );
    }
  });
});
