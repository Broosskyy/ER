import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VenueIdentityResolver, InMemoryEntityAliasStore } from '@/features/entity-resolution';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { InMemoryImportReviewQueueRepository } from '@/features/trust-quality/repositories/in-memory-trust-quality-repositories';
import { ImportReviewQueueService } from '@/features/trust-quality/services/import-review-queue-service';
import { IMPORT_REVIEW_RESOLUTION_REASONS } from '@/features/trust-quality/domain/trust-quality-types';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import type { MultiSourceMatchEvaluation } from '@/features/multi-source-matching/domain/matching-types';
import type { EventLifecycleEvaluation } from '@/features/event-lifecycle/domain/lifecycle-engine-types';

function candidate(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    externalId: 'ext-1',
    rawSourceType: 'api_json',
    title: 'Night',
    venueName: 'Bootshaus',
    cityName: 'Köln',
    countryCode: 'DE',
    startDate: '2026-08-01',
    ...overrides,
  };
}

const catalog: MatchingCatalog = {
  cities: [{ id: 'city-koeln', name: 'Köln' }],
  venues: [
    { id: 'staging-seed-venue-bootshaus', name: 'Bootshaus', cityId: 'city-koeln', cityName: 'Köln' },
    { id: 'venue-bootshaus-koeln', name: 'Bootshaus', cityId: 'city-koeln', cityName: 'Köln' },
  ],
  organizers: [],
  artists: [],
  genres: [],
  events: [],
};

const source: SourceRecord = {
  id: 'source-bootshaus-koeln',
  slug: 'bootshaus',
  displayName: 'Bootshaus',
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
};

function importedRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'rec-1',
    importJobId: 'job-1',
    sourceId: source.id,
    externalId: 'https://bootshaus.tv/events/test',
    rawPayload: {},
    normalizedPayload: candidate(),
    status: 'imported',
    resultingEventId: 'evt-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Sprint 26.9.1 production closure', () => {
  it('migration defines canonical venue alias and scoped venue repair', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260759000000_sprint2691_production_closure.sql'),
      'utf8',
    );
    expect(sql).toContain('venue-bootshaus-koeln');
    expect(sql).toContain('normalized_name');
    expect(sql).toContain("source_id = 'source-bootshaus-koeln'");
    expect(sql).toContain('search_document is null');
  });

  it('canonical defaultVenueId wins against staging catalog match', () => {
    const resolver = new VenueIdentityResolver(new InMemoryEntityAliasStore());
    const outcome = resolver.resolve({
      candidate: candidate({
        sourceMetadata: { defaultVenueId: 'venue-bootshaus-koeln' },
      }),
      catalog,
      sourceId: source.id,
      matchedCityId: 'city-koeln',
    });
    expect(outcome.canonicalId).toBe('venue-bootshaus-koeln');
    expect(outcome.reasonCodes).toContain('source_default_venue_id');
  });

  it('repeated import keeps canonical defaultVenueId', () => {
    const resolver = new VenueIdentityResolver(new InMemoryEntityAliasStore());
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = resolver.resolve({
        candidate: candidate({
          sourceMetadata: { defaultVenueId: 'venue-bootshaus-koeln' },
        }),
        catalog,
        sourceId: source.id,
        matchedCityId: 'city-koeln',
      });
      expect(outcome.canonicalId).toBe('venue-bootshaus-koeln');
    }
  });

  it('closes stale multi_source_match review when record is already published', async () => {
    const repository = new InMemoryImportReviewQueueRepository();
    const service = new ImportReviewQueueService(repository);
    const record = importedRecord();
    const now = new Date().toISOString();

    await repository.upsert({
      id: 'review-1',
      importRecordId: record.id,
      sourceId: source.id,
      externalEventId: record.externalId,
      status: 'pending',
      decision: 'review_required',
      qualityScore: 97,
      reasons: ['Field differences detected (1); downgrading to review.'],
      affectedFields: ['title'],
      ruleIds: [],
      metadata: { reviewType: 'multi_source_match' },
      createdAt: now,
      updatedAt: now,
    });

    const evaluation: MultiSourceMatchEvaluation = {
      id: 'eval-1',
      importRecordId: record.id,
      importJobId: record.importJobId,
      sourceId: record.sourceId,
      externalEventId: record.externalId,
      canonicalEventId: 'evt-1',
      involvedSourceIds: [record.sourceId],
      confidenceScore: 97,
      confidenceTier: 'certain',
      decision: 'review_required',
      reasons: ['Canonical fingerprint matches.'],
      fieldDifferences: [{ field: 'title', incomingValue: 'A', canonicalValue: 'A', severity: 'info' }],
      signals: [],
      fingerprintSnapshot: {},
      createdAt: now,
    };

    const result = await service.reconcileFromMatchEvaluation(record, source, evaluation);
    expect(result.action).toBe('closed');
    expect(result.entry?.status).toBe('expired');
    expect(result.entry?.metadata?.resolutionReason).toBe(
      IMPORT_REVIEW_RESOLUTION_REASONS.matchResolvedOnPublishedRecord,
    );
  });

  it('keeps legitimate lifecycle review when publish has not succeeded', async () => {
    const repository = new InMemoryImportReviewQueueRepository();
    const service = new ImportReviewQueueService(repository);
    const record = importedRecord({ status: 'needs_review', resultingEventId: undefined });
    const now = new Date().toISOString();

    await repository.upsert({
      id: 'review-2',
      importRecordId: record.id,
      sourceId: source.id,
      externalEventId: record.externalId,
      status: 'pending',
      decision: 'review_required',
      qualityScore: 58,
      reasons: ['startDate: event_moved'],
      affectedFields: ['startDate'],
      ruleIds: [],
      metadata: {
        reviewType: 'event_lifecycle',
        resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.publishFailed,
      },
      createdAt: now,
      updatedAt: now,
    });

    const evaluation: EventLifecycleEvaluation = {
      id: 'life-1',
      canonicalEventId: 'evt-1',
      lifecycleEventType: 'event_moved',
      decision: 'review_required',
      changes: [],
      confidenceScore: 58,
      reasons: ['startDate: event_moved'],
      createdAt: now,
    };

    const result = await service.reconcileFromLifecycleEvaluation(record, source, evaluation);
    expect(result.action).toBe('none');
  });

  it('closes stale publish_failed lifecycle review after successful publish', async () => {
    const repository = new InMemoryImportReviewQueueRepository();
    const service = new ImportReviewQueueService(repository);
    const record = importedRecord();
    const now = new Date().toISOString();

    await repository.upsert({
      id: 'review-3',
      importRecordId: record.id,
      sourceId: source.id,
      externalEventId: record.externalId,
      status: 'pending',
      decision: 'review_required',
      qualityScore: 58,
      reasons: ['startDate: event_moved'],
      affectedFields: ['startDate'],
      ruleIds: [],
      metadata: {
        reviewType: 'event_lifecycle',
        resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.publishFailed,
      },
      createdAt: now,
      updatedAt: now,
    });

    const evaluation: EventLifecycleEvaluation = {
      id: 'life-2',
      canonicalEventId: record.resultingEventId!,
      lifecycleEventType: 'event_moved',
      decision: 'apply_immediately',
      changes: [],
      confidenceScore: 80,
      reasons: [],
      createdAt: now,
    };

    const result = await service.reconcileFromLifecycleEvaluation(record, source, evaluation);
    expect(result.action).toBe('closed');
    expect(result.entry?.metadata?.resolutionReason).toBe(
      IMPORT_REVIEW_RESOLUTION_REASONS.lifecycleResolvedOnPublishSuccess,
    );
  });
});
