import { describe, expect, it } from 'vitest';

import {
  filterElectronicMusicEvents,
  isElectronicMusicEvent,
} from '@/features/aggregation/connectors/ticket-platform/electronic-music-scope-filter';
import type { ParsedTicketPlatformEvent } from '@/features/aggregation/connectors/ticket-platform/types';

function createEvent(overrides: Partial<ParsedTicketPlatformEvent> = {}): ParsedTicketPlatformEvent {
  return {
    externalId: 'https://bootshaus-club.ticket.io/test/',
    title: 'Techno Night',
    startDate: '2026-08-01T22:00:00+02:00',
    timezone: 'Europe/Berlin',
    ticketUrl: 'https://bootshaus-club.ticket.io/test/',
    eventUrl: 'https://bootshaus-club.ticket.io/test/',
    platform: 'ticket_io',
    shopSlug: 'bootshaus-club',
    venueName: 'Bootshaus',
    ...overrides,
  };
}

describe('electronic-music-scope-filter', () => {
  it('accepts known club venues', () => {
    expect(isElectronicMusicEvent(createEvent()).accepted).toBe(true);
  });

  it('rejects comedy events', () => {
    const result = isElectronicMusicEvent(
      createEvent({ title: 'Stand-up Comedy Night', venueName: 'Random Hall' }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('excluded_category');
  });

  it('accepts electronic genre keywords in title', () => {
    expect(
      isElectronicMusicEvent(
        createEvent({ title: 'Hard Techno Marathon', venueName: 'Warehouse X' }),
      ).accepted,
    ).toBe(true);
  });

  it('tracks filter statistics', () => {
    const { stats } = filterElectronicMusicEvents([
      createEvent(),
      createEvent({ title: 'Theater Show', venueName: 'Opera' }),
    ]);
    expect(stats.discovered).toBe(2);
    expect(stats.accepted).toBe(1);
    expect(stats.rejected).toBe(1);
  });
});
