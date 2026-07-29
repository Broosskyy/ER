import { describe, expect, it } from 'vitest';

import type { SourceRecord } from '@/data/types/records';
import type { Event } from '@/features/events/types/event';
import {
  aggregateDiscoverySourceTrust,
  buildDiscoverySourceTrustIndex,
  createStaticDiscoverySourceTrustProvider,
  resolveEventDiscoveryTrust,
} from '@/features/discovery/trust/discovery-source-trust';
import { DiscoveryEngine } from '@/features/discovery/services/discovery-engine';
import type { DiscoveryEventSource } from '@/features/discovery/repository/discovery-event-source';

function source(id: string, trustScore: number): SourceRecord {
  return {
    id,
    slug: id,
    displayName: id,
    sourceType: 'website',
    parserType: 'html',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

function event(id: string, sourceId: string): Event {
  return {
    id,
    slug: id,
    title: `Event ${id}`,
    description: 'Test',
    startDateTime: '2026-12-01T22:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Club',
    city: 'Köln',
    country: 'DE',
    genres: ['Techno'],
    artists: [],
    source: sourceId,
    sourceEventId: id,
    status: 'published',
    publishedAt: '2026-07-01T10:00:00.000Z',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  };
}

describe('discovery source trust', () => {
  it('uses the highest trust score for multi-source aggregation', () => {
    expect(aggregateDiscoverySourceTrust([62, 81, 74])).toBe(81);
  });

  it('resolves event trust from source index', () => {
    const index = buildDiscoverySourceTrustIndex([
      source('source-bootshaus-koeln', 76),
      source('source-affenkaefig', 74),
    ]);

    expect(
      resolveEventDiscoveryTrust({
        event: event('evt-1', 'source-bootshaus-koeln'),
        trustBySourceId: index,
      }),
    ).toBeGreaterThan(70);
  });

  it('falls back when source trust is missing', () => {
    expect(
      resolveEventDiscoveryTrust({
        event: event('evt-2', 'unknown-source'),
        trustBySourceId: new Map(),
        fallback: 55,
      }),
    ).toBe(55);
  });

  it('feeds real trust into discovery ranking', async () => {
    const events = [event('evt-a', 'source-high'), event('evt-b', 'source-low')];
    const eventSource: DiscoveryEventSource = {
      listDiscoverableEvents: () => events,
    };

    const engine = new DiscoveryEngine({
      eventSource,
      sourceTrustProvider: createStaticDiscoverySourceTrustProvider(
        new Map([
          ['source-high', 90],
          ['source-low', 40],
        ]),
      ),
    });

    const result = await engine.query({
      surface: 'events_list',
      limit: 10,
    });

    expect(result.items.length).toBe(2);
    expect(result.items[0]?.event.source).toBe('source-high');
  });
});
