import { describe, expect, it } from 'vitest';

import {
  assessConsumerDuplicatePair,
  buildConsumerCanonicalAliases,
  buildConsumerDuplicateGroups,
  getDiscoverablePublishedEvents,
} from '@/features/events/discovery/consumer-discovery-feed';
import type { EventSummary } from '@/features/events/types/event-core';

const REFERENCE = new Date('2026-09-01T12:00:00+02:00');

function summary(overrides: Partial<EventSummary> & Pick<EventSummary, 'id' | 'title' | 'startsAt'>): EventSummary {
  return {
    endsAt: null,
    timezone: 'Europe/Berlin',
    imageUrl: null,
    officialUrl: null,
    organizerName: 'BOOTSHAUS',
    venue: {
      id: 'venue-bootshaus',
      name: 'Bootshaus',
      addressLine: null,
      postalCode: null,
      city: 'Köln',
      countryCode: 'DE',
      latitude: null,
      longitude: null,
      officialUrl: null,
    },
    genres: [],
    primaryTicket: null,
    ...overrides,
  };
}

describe('consumer discovery feed — M9.2.2.5C', () => {
  it('treats Chris Stussy/Stassy as high-confidence typo duplicate with shared ticket URL', () => {
    const left = summary({
      id: '8a8eb9b7-593e-45de-926d-2514735b86cc',
      title: 'CHRIS STUSSY pres. by BOOTSHAUS',
      startsAt: '2026-10-16T20:00:00+00:00',
      officialUrl: 'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus/',
      primaryTicket: {
        id: 't1',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
        priceFromMinor: 4500,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    });
    const right = summary({
      id: '2c00fbb7-baa9-47eb-aaa5-52cda45c79a1',
      title: 'CHRIS STASSY pres. by BOOTSHAUS',
      startsAt: '2026-10-16T20:00:00+00:00',
      officialUrl: 'https://bootshaus.tv/events/chris-stassy-pres-by-bootshaus/',
      primaryTicket: {
        id: 't2',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
        priceFromMinor: 4500,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    });

    const assessment = assessConsumerDuplicatePair(left, right);
    expect(assessment.confidence).toBe('high');

    const feed = getDiscoverablePublishedEvents([left, right], { referenceInstant: REFERENCE });
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0]?.id).toBe(left.id);
  });

  it('does not merge events that only share a ticket URL', () => {
    const left = summary({
      id: 'event-a',
      title: 'Techno Night A',
      startsAt: '2026-11-01T22:00:00+00:00',
      primaryTicket: {
        id: 't1',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/shared/',
        priceFromMinor: 2000,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    });
    const right = summary({
      id: 'event-b',
      title: 'House Night B',
      startsAt: '2026-12-01T22:00:00+00:00',
      primaryTicket: {
        id: 't2',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/shared/',
        priceFromMinor: 2500,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    });

    expect(assessConsumerDuplicatePair(left, right).confidence).toBe('none');
    expect(getDiscoverablePublishedEvents([left, right], { referenceInstant: REFERENCE }).events).toHaveLength(2);
  });

  it('excludes ended multi-day events from discoverable feed', () => {
    const ended = summary({
      id: '7af0f06a-81e1-4708-8359-4a1078b600e3',
      title: 'Nibirii Festival 2026',
      startsAt: '2026-08-28T12:00:00+00:00',
      endsAt: '2026-08-30T23:59:00+00:00',
    });
    const upcoming = summary({
      id: '301c217d-651a-4110-b759-a019f6546bb1',
      title: 'NIBIRII pres. ELY OAKS and more!',
      startsAt: '2026-10-10T20:00:00+00:00',
    });

    const feed = getDiscoverablePublishedEvents([ended, upcoming], { referenceInstant: REFERENCE });
    expect(feed.events.map((event) => event.id)).toEqual([upcoming.id]);
  });

  it('keeps ongoing multi-day events in discoverable feed', () => {
    const ongoing = summary({
      id: 'ongoing-festival',
      title: 'Weekend Festival',
      startsAt: '2026-08-30T12:00:00+00:00',
      endsAt: '2026-09-02T23:00:00+00:00',
    });
    const feed = getDiscoverablePublishedEvents([ongoing], { referenceInstant: REFERENCE });
    expect(feed.events).toHaveLength(1);
  });

  it('builds canonical aliases only for high-confidence duplicate groups', () => {
    const groups = buildConsumerDuplicateGroups([
      summary({ id: 'winner', title: 'Artist A', startsAt: '2026-10-01T20:00:00+00:00' }),
      summary({ id: 'loser', title: 'Artist A', startsAt: '2026-10-01T20:00:00+00:00' }),
    ]);
    const aliases = buildConsumerCanonicalAliases(groups);
    expect(aliases.get('loser')).toBe('winner');
  });
});
