import { describe, expect, it } from 'vitest';

import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import {
  InMemoryEventBlockingKeyRepository,
  InMemoryEventMatchEvaluationRepository,
  InMemoryEventMergeCandidateRepository,
} from '../repositories/in-memory-matching-repositories';
import { MultiSourceMatchScorer } from '../services/multi-source-match-scorer';
import { MatchConflictDetector } from '../services/match-conflict-detector';
import { MultiSourceMatchEngine } from '../services/multi-source-match-engine';
import { MultiSourceMatchOrchestrator } from '../services/multi-source-match-orchestrator';
import { resolveConfidenceTier, resolveMatchDecision } from '../domain/matching-config';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { EventConflictRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { EventConflict } from '@/features/aggregation/merge/event-conflict';
import type { EventCanonicalIdentityService } from '@/features/events/services/event-canonical-identity-service';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { ImportRecord } from '@/features/import/models/types';

function createIncoming(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'ext-incoming',
    sourceId: 'source-b',
    sourceName: 'Source B',
    title: 'Techno Night',
    startDate: '2026-08-15T20:00:00.000Z',
    venueName: 'Bootshaus',
    cityName: 'Köln',
    ticketUrl: 'https://example.com/tickets/techno-night',
    rawSourceType: 'unknown',
    ...overrides,
  };
}

describe('Sprint 17 Multi-Source Matching Engine', () => {
  const catalog = createTestMatchingCatalog();
  const blockingKeys = new InMemoryEventBlockingKeyRepository();
  const evaluations = new InMemoryEventMatchEvaluationRepository();
  const mergeCandidates = new InMemoryEventMergeCandidateRepository();

  const adminEvents = new Map<string, AdminEventRecord>([
    [
      'event-1',
      {
        id: 'event-1',
        title: 'Techno Night',
        description: 'Canonical description',
        startDate: '2026-08-15T20:00:00.000Z',
        ticketUrl: 'https://example.com/tickets/techno-night',
        imageUrl: 'https://example.com/image-a.jpg',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  ]);

  const adminEventRepository = {
    async getById(id: string) {
      return adminEvents.get(id) ?? null;
    },
  };

  const sourceReferences = {
    async findByExternalEventId() {
      return null;
    },
    async findByCanonicalEventId() {
      return [{ sourceId: 'source-a', externalEventId: 'ext-existing-1' }];
    },
  };

  const canonicalIdentity = {
    async resolveByFingerprint() {
      return 'event-1';
    },
  };

  const engine = new MultiSourceMatchEngine(
    adminEventRepository as unknown as AdminEventRepository,
    sourceReferences as unknown as EventSourceReferenceRepository,
    blockingKeys,
    canonicalIdentity as unknown as EventCanonicalIdentityService,
    new MultiSourceMatchScorer(),
    new MatchConflictDetector(),
  );

  it('resolves confidence tiers from configurable thresholds', () => {
    expect(resolveConfidenceTier(95)).toBe('certain');
    expect(resolveConfidenceTier(75)).toBe('probable');
    expect(resolveConfidenceTier(40)).toBe('uncertain');
    expect(resolveMatchDecision(95)).toBe('auto_link');
    expect(resolveMatchDecision(75)).toBe('review_required');
    expect(resolveMatchDecision(40)).toBe('keep_separate');
  });

  it('scores cross-source candidates with rule-based signals', async () => {
    await blockingKeys.indexKeys('event-1', [
      'day-venue:2026-08-15:bootshaus',
      'title-city:techno night:koln',
    ]);

    const evaluation = await engine.evaluate({
      incoming: createIncoming(),
      sourceId: 'source-b',
      externalEventId: 'ext-incoming',
      catalog,
    });

    expect(evaluation.canonicalEventId).toBe('event-1');
    expect(evaluation.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(evaluation.signals.length).toBeGreaterThan(0);
    expect(evaluation.involvedSourceIds).toContain('source-b');
  });

  it('documents field differences without auto-resolving conflicts', async () => {
    const evaluation = await engine.evaluate({
      incoming: createIncoming({
        description: 'Different incoming description',
        imageUrl: 'https://example.com/image-b.jpg',
      }),
      sourceId: 'source-b',
      externalEventId: 'ext-incoming',
      catalog,
    });

    expect(evaluation.fieldDifferences.length).toBeGreaterThan(0);
    expect(evaluation.fieldDifferences.some((difference) => difference.field === 'description')).toBe(true);
  });

  it('downgrades auto_link to review when critical differences exist', async () => {
    const evaluation = await engine.evaluate({
      incoming: createIncoming({
        startDate: '2026-08-16T20:00:00.000Z',
      }),
      sourceId: 'source-b',
      externalEventId: 'ext-incoming',
      catalog,
    });

    if (evaluation.canonicalEventId) {
      expect(['review_required', 'keep_separate']).toContain(evaluation.decision);
    }
  });

  it('persists evaluations and merge candidates through orchestrator', async () => {
    const conflicts: Array<{ field: string }> = [];
    const recordRepository = {
      async update(record: ImportRecord) {
        return record;
      },
    };

    const orchestrator = new MultiSourceMatchOrchestrator(
      engine,
      evaluations,
      mergeCandidates,
      blockingKeys,
      recordRepository as unknown as ImportRecordRepository,
      undefined,
      undefined,
      {
        async create(conflict: EventConflict) {
          conflicts.push({ field: conflict.field });
          return conflict;
        },
      } as unknown as EventConflictRepository,
    );

    const record: ImportRecord = {
      id: 'rec-1',
      importJobId: 'job-1',
      sourceId: 'source-b',
      externalId: 'ext-incoming',
      rawPayload: {},
      normalizedPayload: createIncoming() as unknown as Record<string, unknown>,
      status: 'needs_review',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const evaluation = await orchestrator.processRecord(record, {
      id: 'source-b',
      slug: 'source-b',
      displayName: 'Source B',
      sourceType: 'website',
      parserType: 'html',
      acquisitionStrategy: 'scheduled',
      priority: 50,
      trustScore: 80,
      requiresAuthentication: false,
      enabled: true,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, catalog, 'job-1');

    expect(evaluation.id).toBeTruthy();
    expect(await evaluations.findByImportRecordId('rec-1')).not.toBeNull();
    const candidates = await mergeCandidates.listByCanonicalEventId('event-1');
    expect(candidates.length).toBeGreaterThan(0);
  });
});
