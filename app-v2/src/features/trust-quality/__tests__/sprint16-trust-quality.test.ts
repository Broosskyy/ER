import type { AdminSourceRepository } from '@/data/repositories/repositories';
import { describe, expect, it } from 'vitest';

import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import {
  InMemoryImportReviewQueueRepository,
  InMemorySourceReputationRepository,
  InMemoryTrustQualityRuleRepository,
} from '../repositories/in-memory-trust-quality-repositories';
import { ImportRecordQualityEvaluator } from '../services/import-record-quality-evaluator';
import { ImportReviewQueueService } from '../services/import-review-queue-service';
import { SourceReputationService } from '../services/source-reputation-service';
import { SourceTrustEngine } from '../services/source-trust-engine';
import { TrustPublishDecisionEngine } from '../services/trust-publish-decision-engine';

function createSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-1',
    slug: 'test-source',
    displayName: 'Test Source',
    sourceType: 'website',
    parserType: 'html',
    acquisitionStrategy: 'scheduled',
    priority: 50,
    trustScore: 80,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    publishMode: 'auto_publish',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'rec-1',
    importJobId: 'job-1',
    sourceId: 'source-1',
    externalId: 'ext-1',
    rawPayload: {},
    normalizedPayload: {
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
    },
    status: 'needs_review',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Sprint 16 Trust & Quality Engine', () => {
  const ruleRepository = new InMemoryTrustQualityRuleRepository();
  const qualityEvaluator = new ImportRecordQualityEvaluator();
  const trustEngine = new SourceTrustEngine();
  const decisionEngine = new TrustPublishDecisionEngine(qualityEvaluator, trustEngine);
  const publishDecisionService = new PublishDecisionService(decisionEngine, ruleRepository);

  it('rejects records without required title', async () => {
    const evaluation = await publishDecisionService.evaluate({
      source: createSource(),
      record: createRecord({
        normalizedPayload: { startDate: '2026-08-01T22:00:00.000Z' },
      }),
    });

    expect(evaluation?.decision).toBe('reject');
    expect(evaluation?.reasons.some((reason) => reason.includes('Title'))).toBe(true);
    expect(await publishDecisionService.decide({
      source: createSource(),
      record: createRecord({ normalizedPayload: { startDate: '2026-08-01T22:00:00.000Z' } }),
    })).toBe('skip');
  });

  it('queues review when venue is missing', async () => {
    const evaluation = await publishDecisionService.evaluate({
      source: createSource(),
      record: createRecord({
        normalizedPayload: {
          title: 'Open Air',
          startDate: '2026-08-01T22:00:00.000Z',
          cityName: 'Berlin',
          countryCode: 'DE',
          organizerName: 'Promoter',
          imageUrl: 'https://example.com/poster.jpg',
        },
      }),
    });

    expect(evaluation?.decision).toBe('review_required');
    expect(evaluation?.affectedFields).toContain('venueName');
  });

  it('holds records from low-trust sources with missing organizer/image', async () => {
    const evaluation = await publishDecisionService.evaluate({
      source: createSource({ trustScore: 40, computedTrustScore: 40 }),
      record: createRecord({
        normalizedPayload: {
          title: 'Low Trust Event',
          startDate: '2026-08-01T22:00:00.000Z',
          venueName: 'Club',
          cityName: 'Hamburg',
        },
      }),
    });

    expect(['hold', 'review_required']).toContain(evaluation?.decision);
  });

  it('auto-publishes high-quality records from trusted sources', async () => {
    const evaluation = await publishDecisionService.evaluate({
      source: createSource({ trustScore: 90, computedTrustScore: 90 }),
      record: createRecord(),
    });

    expect(evaluation?.decision).toBe('auto_publish');
    expect(await publishDecisionService.decide({
      source: createSource({ trustScore: 90 }),
      record: createRecord(),
    })).toBe('publish');
  });

  it('enqueues review queue entries with reasons and scores', async () => {
    const reviewRepository = new InMemoryImportReviewQueueRepository();
    const reviewQueue = new ImportReviewQueueService(reviewRepository);
    const record = createRecord({
      normalizedPayload: {
        title: 'Review Me',
        startDate: '2026-08-01T22:00:00.000Z',
        venueName: 'Club',
        cityName: 'Leipzig',
        countryCode: 'DE',
        organizerName: 'Promoter',
        imageUrl: 'https://example.com/poster.jpg',
      },
    });
    const evaluation = decisionEngine.evaluate({
      source: createSource(),
      record,
      rules: await ruleRepository.listEnabled(),
    });

    const entry = await reviewQueue.enqueueFromEvaluation(record, createSource(), evaluation, 'job-1');
    expect(entry).not.toBeNull();
    expect(entry?.status).toBe('pending');
    expect(entry?.reasons.length).toBeGreaterThan(0);
    expect(entry?.qualityScore).toBeDefined();
    expect(entry?.trustScore).toBeDefined();
    expect(entry?.importJobId).toBe('job-1');
  });

  it('updates source reputation after publish decisions', async () => {
    const reputationRepository = new InMemorySourceReputationRepository();
    const sourceRepository = {
      async save(source: SourceRecord) {
        return source;
      },
    } as unknown as AdminSourceRepository;
    const reputationService = new SourceReputationService(
      sourceRepository,
      reputationRepository,
      trustEngine,
    );

    const updated = await reputationService.recordPublishDecision(
      createSource({ trustScore: 75 }),
      'auto_publish',
      { importRecordId: 'rec-1' },
    );

    expect(updated.computedTrustScore).toBeGreaterThan(75);
    const history = await reputationRepository.listBySourceId('source-1');
    expect(history).toHaveLength(1);
    expect(history[0]?.eventType).toBe('publish_success');
  });

  it('applies negative reputation delta on rejected publish', async () => {
    const reputationRepository = new InMemorySourceReputationRepository();
    const sourceRepository = {
      async save(source: SourceRecord) {
        return source;
      },
    } as unknown as AdminSourceRepository;
    const reputationService = new SourceReputationService(
      sourceRepository,
      reputationRepository,
      trustEngine,
    );

    const updated = await reputationService.recordPublishDecision(
      createSource({ trustScore: 75 }),
      'reject',
      { importRecordId: 'rec-1' },
    );

    expect(updated.computedTrustScore).toBeLessThan(75);
  });
});
