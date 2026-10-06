import { describe, expect, it } from 'vitest';

import { matchEventToCatalog } from '../identity/event-matcher';
import type { EventMatchCatalogEntry, EventMatchCandidateInput } from '../identity/event-match-types';
import { assessConsumerDuplicatePair } from '../../../src/features/events/discovery/consumer-discovery-feed';
import type { EventSummary } from '../../../src/features/events/types/event-core';

function catalogEntry(
  overrides: Partial<EventMatchCatalogEntry> & Pick<EventMatchCatalogEntry, 'eventId' | 'title' | 'startsAt'>,
): EventMatchCatalogEntry {
  return {
    timezone: 'Europe/Berlin',
    lineupBillingNames: ['SARA LANDRY'],
    sourceBindings: [
      {
        sourceId: 'bootshaus-source',
        eventId: overrides.eventId,
        sourceRole: 'official',
        sourceUrl: 'https://bootshaus.tv/events/sara-landry/',
      },
    ],
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    ...overrides,
  };
}

function candidate(
  overrides: Partial<EventMatchCandidateInput> & Pick<EventMatchCandidateInput, 'title' | 'startsAt'>,
): EventMatchCandidateInput {
  return {
    timezone: 'Europe/Berlin',
    lineupBillingNames: ['SARA LANDRY'],
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    connectorId: 'ticket-io-network-discovery',
    sourceEventKey: 'ticket_io:bootshaus-club:jhup7wql',
    sourceUrl: 'https://bootshaus-club.ticket.io/jhUP7WQl/',
    ...overrides,
  };
}

describe('cross-source identity regression', () => {
  it('matches ticket.io candidate to existing Bootshaus canonical', () => {
    const result = matchEventToCatalog(
      candidate({
        title: 'SARA LANDRY pres. by BOOTSHAUS',
        startsAt: '2026-12-11T22:00:00+00:00',
      }),
      [
        catalogEntry({
          eventId: 'bootshaus-canonical',
          title: 'SARA LANDRY pres. by BOOTSHAUS',
          startsAt: '2026-12-11T22:00:00+00:00',
          endsAt: '2026-12-12T06:00:00+00:00',
        }),
      ],
    );
    expect(result.decision).toBe('strong_match');
    expect(result.candidateEventId).toBe('bootshaus-canonical');
  });

  it('detects duplicate consumer pair across different venue ids with same normalized venue', () => {
    const left: EventSummary = {
      id: 'bootshaus-canonical',
      title: 'SARA LANDRY pres. by BOOTSHAUS',
      startsAt: '2026-12-11T22:00:00+00:00',
      endsAt: '2026-12-12T06:00:00+00:00',
      timezone: 'Europe/Berlin',
      imageUrl: 'https://bootshaus.tv/image.jpg',
      officialUrl: 'https://bootshaus.tv/events/sara-landry/',
      organizerName: 'Bootshaus',
      venue: {
        id: 'venue-a',
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
    };
    const right: EventSummary = {
      ...left,
      id: 'ticket-io-duplicate',
      officialUrl: 'https://bootshaus-club.ticket.io/jhUP7WQl/',
      venue: { ...left.venue!, id: 'venue-b' },
      primaryTicket: {
        id: 'ticket',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/jhUP7WQl/',
        priceFromMinor: 3290,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    };
    const assessment = assessConsumerDuplicatePair(left, right);
    expect(assessment.confidence).toBe('high');
  });
});
