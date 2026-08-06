import { describe, expect, it } from 'vitest';

import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source.core';
import { fieldTrustMergeService } from '@/features/import/services/field-trust-merge-service';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import {
  classifyTicketUrl,
  eventNeedsTicketDestinationRepair,
  isGenericTicketUrl,
  resolveBetterTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import { clearEventDetailCache } from '@/features/event-detail/feed/discovery-event-detail-client';
import { clearHomeFeedRequestCache } from '@/features/home/feed/discovery-feed-client';
import type { AdminEventRecord } from '@/data/types/records';

const DEEP_LINK = 'https://bootshaus-club.ticket.io/gPHSUV3l/';
const GENERIC_SHOP = 'https://bootshaus.ticket.io/';
const GENERIC_CLUB_SHOP = 'https://bootshaus-club.ticket.io/';

describe('ticket-url-quality', () => {
  it('classifies event-specific Ticket.io URLs above shop roots', () => {
    expect(classifyTicketUrl(DEEP_LINK).class).toBe('event_specific');
    expect(classifyTicketUrl(GENERIC_CLUB_SHOP).class).toBe('shop_root');
    expect(classifyTicketUrl(GENERIC_SHOP).class).toBe('shop_root');
    expect(isGenericTicketUrl(GENERIC_SHOP)).toBe(true);
  });

  it('prefers event-specific URL over shop root', () => {
    const resolution = resolveBetterTicketUrl(GENERIC_SHOP, DEEP_LINK);
    expect(resolution.decision).toBe('accepted_incoming');
    expect(resolution.selected).toBe(DEEP_LINK);
  });

  it('rejects generic URL overwriting event-specific URL', () => {
    const resolution = resolveBetterTicketUrl(DEEP_LINK, GENERIC_SHOP);
    expect(resolution.decision).toBe('kept_existing');
    expect(resolution.selected).toBe(DEEP_LINK);
  });

  it('rejects empty URL overwriting real URL', () => {
    const resolution = resolveBetterTicketUrl(DEEP_LINK, '');
    expect(resolution.decision).toBe('kept_existing');
    expect(resolution.selected).toBe(DEEP_LINK);
  });

  it('allows shop root when no event-specific URL exists', () => {
    const resolution = resolveBetterTicketUrl(undefined, GENERIC_CLUB_SHOP);
    expect(resolution.decision).toBe('filled_empty');
    expect(resolution.selected).toBe(GENERIC_CLUB_SHOP);
  });

  it('prefers ticket shop root over bootshaus.tv event info page', () => {
    const infoPage = 'https://bootshaus.tv/events/nightswithus-presents-levi';
    expect(classifyTicketUrl(infoPage).class).toBe('event_info_page');
    const resolution = resolveBetterTicketUrl(infoPage, GENERIC_SHOP);
    expect(resolution.decision).toBe('accepted_incoming');
    expect(resolution.selected).toBe(GENERIC_SHOP);
  });

  it('flags bootshaus.tv ticket URLs for destination repair when shop root exists', () => {
    expect(
      eventNeedsTicketDestinationRepair(
        'https://bootshaus.tv/events/nightswithus-presents-levi',
        ['https://bootshaus.ticket.io/'],
      ),
    ).toBe(true);
  });
});

describe('import-update-service ticket URL preservation', () => {
  const existing: AdminEventRecord = {
    id: 'evt-play',
    title: 'PLAY! Open Air – Bootshaus Köln',
    description: 'Restored description',
    startDate: '2026-08-01T12:00:00.000Z',
    ticketUrl: DEEP_LINK,
    priceText: 'Tickets ab 18,00 Euro',
    sourceId: 'source-bootshaus-koeln',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('preserves Ticket.io deep link when website reimport adds description', () => {
    const updated = importUpdateService.buildUpdatedAdminEvent(
      existing,
      {
        externalId: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln',
        sourceId: 'source-bootshaus-koeln',
        sourceName: 'Bootshaus Köln',
        title: existing.title,
        startDate: existing.startDate,
        description: 'Long restored description from website detail page',
        ticketUrl: GENERIC_SHOP,
        rawSourceType: 'html',
      },
      'source-bootshaus-koeln',
    );
    expect(updated.description).toContain('Long restored description');
    expect(updated.ticketUrl).toBe(DEEP_LINK);
    expect(updated.priceText).toBe('Tickets ab 18,00 Euro');
  });
});

describe('field-trust-merge-service ticket URL preservation', () => {
  const existing: AdminEventRecord = {
    id: 'evt-play',
    title: 'PLAY! Open Air – Bootshaus Köln',
    description: 'Restored description',
    startDate: '2026-08-01T12:00:00.000Z',
    ticketUrl: DEEP_LINK,
    priceText: 'Tickets ab 18,00 Euro',
    sourceId: 'source-bootshaus-koeln',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('website reimport cannot downgrade ticket URL via field trust merge', () => {
    const website = createBootshausProductionSourceRecord();
    const result = fieldTrustMergeService.mergeAdminEvent({
      existing,
      candidate: {
        externalId: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln',
        sourceId: website.id,
        sourceName: website.displayName,
        title: existing.title,
        startDate: existing.startDate,
        description: 'Updated website description',
        ticketUrl: GENERIC_SHOP,
        rawSourceType: 'html',
      },
      source: website,
      behavior: 'auto_publish',
    });
    expect(result.event.ticketUrl).toBe(DEEP_LINK);
  });

  it('ticket.io enrichment upgrades generic canonical URL to deep link', () => {
    const ticketSource = createBootshausTicketIoProductionSourceRecord();
    const genericExisting = { ...existing, ticketUrl: GENERIC_SHOP };
    const result = fieldTrustMergeService.mergeAdminEvent({
      existing: genericExisting,
      candidate: {
        externalId: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
        sourceId: ticketSource.id,
        sourceName: ticketSource.displayName,
        title: genericExisting.title,
        startDate: genericExisting.startDate,
        ticketUrl: DEEP_LINK,
        priceText: 'Tickets ab 18,00 Euro',
        rawSourceType: 'json_ld',
      },
      source: ticketSource,
      behavior: 'enrichment',
    });
    expect(result.event.ticketUrl).toBe(DEEP_LINK);
  });
});

describe('cache invalidation hooks', () => {
  it('clears event detail cache without throwing', () => {
    expect(() => clearEventDetailCache()).not.toThrow();
    expect(() => clearHomeFeedRequestCache()).not.toThrow();
  });
});

describe('merge-strategy ticket URL tiebreaker', () => {
  it('prefers higher-priority source when ticket URL quality is tied', async () => {
    const { PriorityBasedMergeStrategy } = await import('@/features/aggregation/merge/merge-strategy');
    const strategy = new PriorityBasedMergeStrategy();
    const base = {
      sourceId: 'generic-source',
      externalId: 'g-1',
      title: 'Test Event',
      startDate: '2026-08-01T20:00:00.000Z',
      ticketUrl: 'https://generic.example/tickets',
    };
    const first = strategy.merge(base as any, undefined, {
      sourcePriority: 50,
      sourceTrustScore: 60,
      retrievedAt: '2026-01-01T00:00:00.000Z',
    });
    const merged = strategy.merge(
      {
        ...base,
        sourceId: 'ticket-partner',
        externalId: 't-1',
        ticketUrl: 'https://tickets.example/open-air',
      } as any,
      first,
      {
        sourcePriority: 80,
        sourceTrustScore: 90,
        retrievedAt: '2026-01-02T00:00:00.000Z',
      },
    );
    expect(merged.canonicalEvent.ticketUrl).toBe('https://tickets.example/open-air');
  });
});
