import { describe, expect, it } from 'vitest';

import { PriorityBasedMergeStrategy } from '@/features/aggregation/merge/merge-strategy';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

function event(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'evt-1',
    sourceId: 'source-a',
    sourceName: 'Eventbrite',
    title: 'Open Air',
    startDate: '2026-08-01T20:00:00.000Z',
    venueName: 'Flutgraben',
    cityName: 'Berlin',
    description: 'Low priority description',
    ticketUrl: 'https://a.example/tickets',
    rawSourceType: 'api_json',
    ...overrides,
  };
}

describe('merge strategy', () => {
  it('creates a new merge group for first source contribution', () => {
    const strategy = new PriorityBasedMergeStrategy();
    const merged = strategy.merge(event(), undefined, {
      sourcePriority: 60,
      sourceTrustScore: 70,
      retrievedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(merged.mergeGroupId).toBe('source-a:evt-1');
    expect(merged.sourceContributions).toHaveLength(1);
    expect(merged.primarySourceId).toBe('source-a');
  });

  it('merges higher-priority source data into existing group', () => {
    const strategy = new PriorityBasedMergeStrategy();
    const first = strategy.merge(event(), undefined, {
      sourcePriority: 40,
      sourceTrustScore: 50,
      retrievedAt: '2026-01-01T00:00:00.000Z',
    });

    const second = strategy.merge(
      event({
        externalId: 'evt-2',
        sourceId: 'source-b',
        sourceName: 'RA',
        description: 'High priority description',
        ticketUrl: 'https://b.example/tickets',
      }),
      first,
      {
        sourcePriority: 90,
        sourceTrustScore: 80,
        retrievedAt: '2026-01-02T00:00:00.000Z',
      },
    );

    expect(second.sourceContributions).toHaveLength(2);
    expect(second.canonicalEvent.description).toBe('High priority description');
    expect(second.primarySourceId).toBe('source-b');
  });

  it('retains alternatives and gives manual field overrides precedence', () => {
    const strategy = new PriorityBasedMergeStrategy();
    const first = strategy.merge(event(), undefined, {
      sourcePriority: 80,
      sourceTrustScore: 80,
      retrievedAt: '2026-01-01T00:00:00.000Z',
    });
    const merged = strategy.merge(
      event({ sourceId: 'source-ticket', ticketUrl: 'https://incoming.example/tickets' }),
      first,
      {
        sourcePriority: 20,
        sourceTrustScore: 40,
        sourceType: 'ticket_partner',
        manualOverrides: { ticketUrl: 'https://admin.example/tickets' },
        retrievedAt: '2026-01-02T00:00:00.000Z',
      },
    );

    expect(merged.canonicalEvent.ticketUrl).toBe('https://admin.example/tickets');
    expect(merged.fieldProvenance?.ticketUrl?.selectionReason).toBe('manual_override');
    expect(merged.fieldProvenance?.ticketUrl?.alternatives).toHaveLength(1);
  });
});
