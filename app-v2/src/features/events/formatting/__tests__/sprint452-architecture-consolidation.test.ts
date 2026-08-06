import { describe, expect, it } from 'vitest';

import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { hasValidCoordinates } from '@/features/events/formatting/coordinates';
import { hasValidEventCoordinates } from '@/features/events/domain/event-field-value';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { clearEventDetailCache } from '@/features/event-detail/feed/discovery-event-detail-client';
import { clearHomeFeedRequestCache } from '@/features/home/feed/discovery-feed-client';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';

describe('sprint452 projection parity', () => {
  it('projects consistent consumer fields from canonical input', () => {
    const canonical = projectCanonicalEventFields({
      title: 'Projection Parity Night',
      description: 'Long description body',
      priceText: 'Tickets ab 18,00 Euro',
      ticketUrl: 'https://bootshaus-club.ticket.io/abc123/',
      venue: 'Bootshaus, Köln',
      city: 'Köln',
      source: 'source-bootshaus-ticket-io',
      genres: ['Techno'],
      artists: ['DJ Test'],
    });

    expect(canonical.venueLabel).toBe('Bootshaus');
    expect(canonical.cityLabel).toBe('Köln');
    expect(canonical.locationLabelComma).toBe('Bootshaus, Köln');
    expect(canonical.displayPriceText).toBe('ab 18,00 €');
    expect(canonical.ticketProviderLabel).toBe(
      getSourceDisplayLabel('source-bootshaus-ticket-io', 'https://bootshaus-club.ticket.io/abc123/'),
    );
    expect(canonical.sanitizedDescription).toBe('Long description body');
  });
});

describe('sprint452 formatter authority', () => {
  it('uses single price formatter for display projection', () => {
    expect(formatDisplayPriceText('Tickets ab 18,00 Euro')).toBe('ab 18,00 €');
  });

  it('aligns coordinate validation with event-field-value', () => {
    expect(hasValidCoordinates(50.95, 6.98)).toBe(hasValidEventCoordinates(50.95, 6.98));
    expect(hasValidCoordinates(0, 0)).toBe(hasValidEventCoordinates(0, 0));
  });
});

describe('sprint452 cache invalidation', () => {
  it('invalidates consumer caches without throwing', async () => {
    clearEventDetailCache();
    clearHomeFeedRequestCache();
    await expect(invalidateConsumerEventCaches()).resolves.toBeUndefined();
  });
});

describe('sprint452 provenance writer', () => {
  it('exposes ticket URL correction writer for targeted provenance repair', () => {
    const repo = {
      findByCanonicalEventId: async () => [],
      findByFieldPath: async () => null,
      upsertFieldSelection: async (row: { value: unknown }) => row,
      listAlternatives: async () => [],
      setManualOverride: async () => ({}),
      clearManualOverride: async () => undefined,
    };
    const writer = new EventFieldProvenanceWriter(repo as never);
    expect(typeof writer.writeTicketUrlCorrection).toBe('function');
    expect(typeof writer.loadProvenanceByField).toBe('function');
  });
});
