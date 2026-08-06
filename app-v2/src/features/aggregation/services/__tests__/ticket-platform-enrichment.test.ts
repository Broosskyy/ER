import { describe, expect, it } from 'vitest';

import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source.core';

describe('ticket platform enrichment updates', () => {
  const existing: AdminEventRecord = {
    id: 'evt-bootshaus-1',
    title: 'Bootshaus Sommerfest',
    description: 'Official description',
    startDate: '2026-08-01T20:00:00.000Z',
    venueName: 'Bootshaus',
    sourceId: 'source-bootshaus-koeln',
    status: 'published',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };

  const incoming: CanonicalImportEvent = {
    sourceId: 'source-bootshaus-ticket-io',
    sourceName: 'Bootshaus Ticket.io',
    externalId: 'https://bootshaus-club.ticket.io/NEtJnQ4A/',
    title: 'Different Title From Ticket.io',
    description: 'Ticket shop description',
    startDate: '2026-08-01T22:00:00.000Z',
    ticketUrl: 'https://bootshaus-club.ticket.io/NEtJnQ4A/',
    venueName: 'Bootshaus',
    cityName: 'Köln',
    rawSourceType: 'json_ld',
    sourceMetadata: {
      pageTitle: 'Bootshaus Sommerfest',
      listRowTitle: 'Bootshaus Sommerfest',
      eventDate: '2026-08-01T20:00:00.000Z',
      venueName: 'Bootshaus',
      verifiedAt: '2026-02-01T12:00:00.000Z',
      publicTicketPageUrl: 'https://bootshaus-club.ticket.io/NEtJnQ4A/',
    },
  };

  it('enriches ticket URL without overwriting official title', () => {
    const enriched = importUpdateService.buildEnrichmentAdminEvent(existing, incoming);
    expect(enriched.title).toBe('Bootshaus Sommerfest');
    expect(enriched.description).toBe('Official description');
    expect(enriched.ticketUrl).toBe('https://bootshaus-club.ticket.io/NEtJnQ4A/');
    expect(enriched.sourceId).toBe('source-bootshaus-koeln');
  });

  it('identifies enrichment via publish behavior', () => {
    const ticketSource = createBootshausTicketIoProductionSourceRecord();
    expect(importUpdateService.isEnrichmentSource(ticketSource)).toBe(true);
    expect(importUpdateService.isTicketPlatformEnrichmentSource('ticket_platform')).toBe(true);
    expect(importUpdateService.isEnrichmentSource({ sourceType: 'website', enabled: true })).toBe(false);
  });
});
