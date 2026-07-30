import { describe, expect, it } from 'vitest';

import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import type { SourceRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import { createEventOriginsBackfillHandler } from '@/features/operations/backfill/event-origins-backfill-handler';
import { buildOriginBackfillPlan } from '@/features/operations/backfill/event-origins-backfill-plan';
import { assertOnboardingStatusTransition } from '@/features/source-onboarding/domain/status-transitions';
import { fetchDiscoveryDocument } from '@/features/source-onboarding/discovery/source-discovery-engine';
import { normalizeSubmittedSourceUrl } from '@/features/source-onboarding/security/url-normalizer';

describe('Sprint 33.1 status transitions', () => {
  it('allows submitted -> probing -> discovered -> ready path', () => {
    expect(() => assertOnboardingStatusTransition('submitted', 'probing')).not.toThrow();
    expect(() => assertOnboardingStatusTransition('probing', 'discovered')).not.toThrow();
    expect(() => assertOnboardingStatusTransition('dry_run', 'ready')).not.toThrow();
  });

  it('blocks invalid transitions', () => {
    expect(() => assertOnboardingStatusTransition('submitted', 'enabled')).toThrow();
    expect(() => assertOnboardingStatusTransition('enabled', 'ready')).toThrow();
  });
});

describe('Sprint 33.1 SSRF hardening', () => {
  it('blocks dangerous URL schemes before normalization', () => {
    const blocked = [
      'file:///etc/passwd',
      'ftp://example.com/events',
      'data:text/html,<script>',
      'javascript:alert(1)',
      'http://127.0.0.1/events',
      'http://localhost/events',
      'http://[::1]/events',
      'http://10.0.0.1/events',
      'http://192.168.1.1/events',
      'http://169.254.169.254/latest/meta-data',
    ];
    for (const url of blocked) {
      expect(() => normalizeSubmittedSourceUrl(url)).toThrow();
    }
  });

  it('validates each redirect hop in discovery fetch', async () => {
    const originalFetch = global.fetch;
    let callCount = 0;
    global.fetch = async (input: RequestInfo | URL) => {
      callCount += 1;
      const url = String(input);
      if (callCount === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/private' },
        });
      }
      return new Response('<html></html>', { status: 200 });
    };
    try {
      await expect(fetchDiscoveryDocument('https://public.example/events')).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Sprint 33.1 origin backfill idempotency', () => {
  it('second backfill pass does not create duplicate origin metadata', async () => {
    const repos = new InMemoryMultiSourceRepositories();
    const source: SourceRecord = {
      id: 'source-bootshaus-koeln',
      slug: 'bootshaus',
      displayName: 'Bootshaus',
      sourceType: 'website',
      parserType: 'html',
      acquisitionStrategy: 'html_cards',
      connectorKey: 'club_website',
      priority: 80,
      trustScore: 90,
      requiresAuthentication: false,
      enabled: true,
      archived: false,
      reviewRequired: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const event = {
      id: 'evt-1',
      title: 'Techno Night',
      description: 'Test',
      startDate: '2026-08-01T22:00:00+02:00',
      sourceId: source.id,
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      websiteUrl: 'https://bootshaus.tv/events/test',
    };
    const record: ImportRecord = {
      id: 'rec-1',
      sourceId: source.id,
      externalId: 'https://bootshaus.tv/events/test',
      sourceUrl: 'https://bootshaus.tv/events/test',
      originalUrl: 'https://bootshaus.tv/events/test',
      status: 'imported',
      createdAt: '2026-01-01T00:00:00.000Z',
      retrievedAt: '2026-01-01T00:00:00.000Z',
      resultingEventId: 'evt-1',
      normalizedPayload: {
        title: 'Techno Night',
        startDate: '2026-08-01T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
    };

    const handler = createEventOriginsBackfillHandler(
      {
        list: async () => ({ items: [event], total: 1 }),
      },
      { getAll: async () => [source] },
      repos.sourceReferences,
      {
        findLatestBySourceAndExternalId: async () => record,
      } as never,
    );

    const job = {
      id: 'backfill-test-1',
      backfillType: 'event_origins' as const,
      status: 'running' as const,
      processedCount: 0,
      errorCount: 0,
      batchSize: 50,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const first = await handler.processBatch(job, 50);
    const second = await handler.processBatch(
      { ...job, id: 'backfill-test-2', cursorValue: '0' },
      50,
    );

    const references = await repos.sourceReferences.findByCanonicalEventId('evt-1');
    expect(references).toHaveLength(1);
    expect(first.processed).toBe(1);
    expect(second.processed).toBe(1);
    expect(references[0]?.metadata?.role).toBe('official');
    expect(references[0]?.metadata?.backfilledAt).toBeDefined();
  });

  it('builds dry-run plan without writes', async () => {
    const repos = new InMemoryMultiSourceRepositories();
    const plan = await buildOriginBackfillPlan({
      eventRepository: { list: async () => ({ items: [], total: 0 }) },
      sourceRepository: { getAll: async () => [] },
      sourceReferences: repos.sourceReferences,
      importRecordRepository: { findLatestBySourceAndExternalId: async () => null } as never,
    });
    expect(plan.eventsExamined).toBe(0);
    expect(plan.plannedInserts).toBe(0);
  });
});
