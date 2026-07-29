import { describe, expect, it } from 'vitest';
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

function createManualReviewSource(): SourceRecord {
  return {
    id: 'source-affenkaefig',
    slug: 'affenkaefig',
    displayName: 'Affenkäfig',
    sourceType: 'website',
    parserType: 'html',
    acquisitionStrategy: 'scheduled',
    priority: 50,
    trustScore: 80,
    computedTrustScore: 80,
    requiresAuthentication: false,
    enabled: false,
    archived: false,
    publishMode: 'manual_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createRecordInput(jobId: string, externalId: string) {
  return {
    importJobId: jobId,
    sourceId: 'source-affenkaefig',
    externalId,
    rawPayload: {},
    normalizedPayload: {
      title: 'Test Event',
      startDate: '2026-10-23T22:00:00.000Z',
      venueName: 'Bootshaus Köln',
      cityName: 'Köln',
      countryCode: 'DE',
      organizerName: 'Affenkäfig',
      eventUrl: externalId,
    },
    status: 'needs_review' as const,
  };
}

function buildStack(options?: { withTrustRules?: boolean }) {
  const bundle = createLocalImportDatasourceBundle();
  const multiSource = new InMemoryMultiSourceRepositories();
  const reviewRepository = new InMemoryImportReviewQueueRepository();
  const reviewQueueService = new ImportReviewQueueService(reviewRepository);
  const ruleRepository = new InMemoryTrustQualityRuleRepository();
  const publishDecision = options?.withTrustRules
    ? new PublishDecisionService(
        new TrustPublishDecisionEngine(new ImportRecordQualityEvaluator(), new SourceTrustEngine()),
        ruleRepository,
      )
    : new PublishDecisionService();
  const adminEvents: AdminEventRecord[] = [];
  const adminEventRepository = {
    async getById(id: string) {
      return adminEvents.find((event) => event.id === id) ?? null;
    },
    async save(event: AdminEventRecord) {
      adminEvents.push(event);
      return event;
    },
  };
  const publishService = new ImportEventPublishService(
    bundle.importRecords,
    adminEventRepository,
    multiSource.sourceReferences,
  );
  const orchestrator = new ImportPublishOrchestratorService(
    bundle.importRecords,
    publishService,
    publishDecision,
    undefined,
    reviewQueueService,
  );

  const upsertDeps = {
    findLatest: (sourceId: string, externalId: string) =>
      bundle.importRecords.findLatestBySourceAndExternalId(sourceId, externalId),
    create: (value: Parameters<typeof bundle.importRecords.create>[0]) => bundle.importRecords.create(value),
    update: (value: ImportRecord) => bundle.importRecords.update(value),
  };

  return { bundle, reviewRepository, reviewQueueService, orchestrator, upsertDeps };
}

describe('Sprint 28.3 review queue orphan reconcile', () => {
  it('creates queue entries for legacy manual_review path without trust evaluation', async () => {
    const { reviewRepository, orchestrator, upsertDeps } = buildStack({ withTrustRules: false });
    const source = createManualReviewSource();
    const jobId = 'job-orphan-legacy';
    const input = createRecordInput(jobId, 'https://affenkaefig.info/event/example/');

    await upsertImportRecordsBySourceExternal([input], upsertDeps);

    const result = await orchestrator.processJobRecords(jobId, source, [], 'tester');

    expect(result.queuedCount).toBe(1);
    const pending = await reviewRepository.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.externalEventId).toBe(input.externalId);
    expect(pending[0]?.decision).toBe('review_required');
    expect(pending[0]?.reasons).toContain('import_record_requires_manual_review');
  });

  it('reconciles orphaned needs_review records after simulated job failure', async () => {
    const { reviewRepository, orchestrator, upsertDeps } = buildStack({ withTrustRules: true });
    const source = createManualReviewSource();
    const jobId = 'job-failed-before-publish';
    const inputs = [
      createRecordInput(jobId, 'https://affenkaefig.info/event/a/'),
      createRecordInput(jobId, 'https://affenkaefig.info/event/b/'),
    ];

    await upsertImportRecordsBySourceExternal(inputs, upsertDeps);

    const reconciled = await orchestrator.reconcileOrphanedJobRecords(jobId, source);

    expect(reconciled).toBe(2);
    const pending = await reviewRepository.listPending();
    expect(pending).toHaveLength(2);
  });

  it('ensureQueuedForReview is idempotent for existing active reviews', async () => {
    const { reviewRepository, reviewQueueService } = buildStack({ withTrustRules: true });
    const source = createManualReviewSource();
    const record: ImportRecord = {
      id: 'record-idem',
      importJobId: 'job-idem',
      sourceId: source.id,
      externalId: 'https://affenkaefig.info/event/idempotent/',
      rawPayload: {},
      normalizedPayload: createRecordInput('job-idem', 'https://affenkaefig.info/event/idempotent/')
        .normalizedPayload,
      status: 'needs_review',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const first = await reviewQueueService.ensureQueuedForReview(record, source, null, 'job-idem');
    const second = await reviewQueueService.ensureQueuedForReview(record, source, null, 'job-idem');

    expect(first.action).toBe('created');
    expect(second.action).toBe('none');
    expect(await reviewRepository.listPending()).toHaveLength(1);
  });
});
