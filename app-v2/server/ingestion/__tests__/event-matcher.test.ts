import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../adapters/official-evidence-adapter';
import { matchEventToCatalog } from '../identity/event-matcher';
import type { EventMatchCatalogEntry, EventMatchCandidateInput } from '../identity/event-match-types';
import { isPlanIdempotent, planOfficialEventWrite, planOfficialEventWrites } from '../planning/event-write-planner';
import type { OfficialEventEvidence } from '../../official-connectors/types';

function catalogEntry(overrides: Partial<EventMatchCatalogEntry> & Pick<EventMatchCatalogEntry, 'eventId' | 'title' | 'startsAt'>): EventMatchCatalogEntry {
  return {
    timezone: 'Europe/Berlin',
    lineupBillingNames: [],
    sourceBindings: [],
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    ...overrides,
  };
}

function candidate(overrides: Partial<EventMatchCandidateInput> & Pick<EventMatchCandidateInput, 'title' | 'startsAt'>): EventMatchCandidateInput {
  return {
    timezone: 'Europe/Berlin',
    lineupBillingNames: [],
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    ...overrides,
  };
}

function evidence(overrides: Partial<OfficialEventEvidence> & Pick<OfficialEventEvidence, 'sourceEventKey' | 'officialUrl' | 'title' | 'startsAt'>): OfficialEventEvidence {
  return {
    connectorId: 'bootshaus-official',
    listUrl: 'https://bootshaus.tv/events/',
    fetchedAt: '2026-08-14T12:00:00.000Z',
    pageFingerprint: 'fp',
    sourceTimezone: 'Europe/Berlin',
    venue: { name: 'Bootshaus', city: 'Köln', postalCode: '51063', countryCode: 'DE' },
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps: [],
    rejectedCandidates: [],
    ...overrides,
  };
}

describe('event matcher golden matrix', () => {
  it('A — exact source binding', () => {
    const result = matchEventToCatalog(
      candidate({
        title: 'Loonyland',
        startsAt: '2027-08-21T22:00:00+02:00',
        sourceUrl: 'https://bootshaus.tv/events/loonyland/',
      }),
      [
        catalogEntry({
          eventId: 'event-a',
          title: 'Loonyland',
          startsAt: '2027-08-21T22:00:00+02:00',
          sourceBindings: [
            {
              sourceId: 'source-a',
              eventId: 'event-a',
              sourceRole: 'official',
              sourceUrl: 'https://bootshaus.tv/events/loonyland/',
            },
          ],
        }),
      ],
    );
    expect(result.decision).toBe('exact_match');
    expect(result.candidateEventId).toBe('event-a');
    expect(result.autoBindAllowed).toBe(true);
  });

  it('B — strong cross-source match', () => {
    const result = matchEventToCatalog(
      candidate({
        title: 'Nibirii 2027',
        startsAt: '2027-07-17T14:00:00+02:00',
        venueName: 'Gewerbegebiet Auenweg',
        venueCity: 'Köln',
        lineupBillingNames: ['Vertile', 'Kobosil'],
      }),
      [
        catalogEntry({
          eventId: 'event-b',
          title: 'Nibirii Festival 2027',
          startsAt: '2027-07-17T14:00:00+02:00',
          venueName: 'Gewerbegebiet Auenweg',
          venueCity: 'Köln',
          lineupBillingNames: ['Vertile', 'Kobosil', 'I Hate Models'],
        }),
      ],
    );
    expect(result.decision).toBe('strong_match');
    expect(result.candidateEventId).toBe('event-b');
  });

  it('C — different festival edition', () => {
    const result = matchEventToCatalog(
      candidate({ title: 'Nibirii Festival 2027', startsAt: '2027-07-17T14:00:00+02:00' }),
      [catalogEntry({ eventId: 'event-c', title: 'Nibirii Festival 2026', startsAt: '2026-07-17T14:00:00+02:00' })],
    );
    expect(result.decision).toBe('no_match');
  });

  it('D — recurring party different week', () => {
    const result = matchEventToCatalog(
      candidate({ title: 'UNREAL', startsAt: '2027-08-30T23:00:00+02:00', venueName: 'Bootshaus', venueCity: 'Köln' }),
      [catalogEntry({ eventId: 'event-d', title: 'UNREAL', startsAt: '2027-09-06T23:00:00+02:00', venueName: 'Bootshaus', venueCity: 'Köln' })],
    );
    expect(result.decision).toBe('no_match');
    expect(result.reasons).toContain('recurring_series_different_week');
  });

  it('E — similar title but different venue', () => {
    const result = matchEventToCatalog(
      candidate({ title: 'Techno Night', startsAt: '2027-08-21T22:00:00+02:00', venueName: 'Bootshaus', venueCity: 'Köln' }),
      [catalogEntry({ eventId: 'event-e', title: 'Techno Night', startsAt: '2027-08-21T22:00:00+02:00', venueName: 'Odonien', venueCity: 'Köln' })],
    );
    expect(['no_match', 'review_required']).toContain(result.decision);
    expect(result.autoBindAllowed).toBe(false);
  });

  it('F — slight start-time discrepancy', () => {
    const result = matchEventToCatalog(
      candidate({ title: 'Chris Stussy', startsAt: '2027-10-16T22:30:00+02:00', lineupBillingNames: ['CHRIS STUSSY'] }),
      [
        catalogEntry({
          eventId: 'event-f',
          title: 'CHRIS STUSSY pres. by BOOTSHAUS',
          startsAt: '2027-10-16T22:00:00+02:00',
          lineupBillingNames: ['CHRIS STUSSY'],
        }),
      ],
    );
    expect(result.decision).toBe('strong_match');
  });

  it('F2 — Chris Stussy/Stassy title typo with same lineup and slot', () => {
    const result = matchEventToCatalog(
      candidate({
        title: 'CHRIS STASSY pres. by BOOTSHAUS',
        startsAt: '2026-10-16T22:00:00+02:00',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        lineupBillingNames: ['CHRIS STUSSY'],
      }),
      [
        catalogEntry({
          eventId: 'event-stussy',
          title: 'CHRIS STUSSY pres. by BOOTSHAUS',
          startsAt: '2026-10-16T22:00:00+02:00',
          venueName: 'Bootshaus',
          venueCity: 'Köln',
          lineupBillingNames: ['CHRIS STUSSY'],
        }),
      ],
    );
    expect(result.decision).toBe('strong_match');
    expect(result.autoBindAllowed).toBe(true);
  });

  it('G — source URL changed with strong remaining identity', () => {
    const plan = planOfficialEventWrite(officialEvidenceToEventCandidate(evidence({
      sourceEventKey: 'nibirii-2027',
      officialUrl: 'https://nibirii.de/events/nibirii-festival-2027-new/',
      title: 'Nibirii Festival 2027',
      startsAt: '2027-07-17T14:00:00+02:00',
      pageFingerprint: 'fp-new-url',
    })), {
      existingSources: [
        {
          sourceId: 'source-old',
          eventId: 'event-g',
          sourceUrl: 'https://nibirii.de/events/nibirii-festival-2027/',
          contentHash: 'fp-old',
          sourceEventKey: 'nibirii-2027',
          connectorId: 'bootshaus-official',
        },
      ],
      existingVenues: [],
      existingEvents: [
        {
          eventId: 'event-g',
          title: 'Nibirii Festival 2027',
          description: 'Festival',
          startsAt: '2027-07-17T14:00:00+02:00',
          endsAt: '2027-07-19T23:00:00+02:00',
          timezone: 'Europe/Berlin',
          organizerName: 'Nibirii',
          imageUrl: null,
          venueId: 'venue-1',
          status: 'published',
          lineup: [],
          genres: [],
        },
      ],
      eventCatalog: [
        catalogEntry({
          eventId: 'event-g',
          title: 'Nibirii Festival 2027',
          startsAt: '2027-07-17T14:00:00+02:00',
          venueName: 'Gewerbegebiet Auenweg',
          venueCity: 'Köln',
          sourceBindings: [
            {
              sourceId: 'source-old',
              eventId: 'event-g',
              sourceRole: 'official',
              sourceUrl: 'https://nibirii.de/events/nibirii-festival-2027/',
              sourceEventKey: 'nibirii-2027',
              connectorId: 'bootshaus-official',
            },
          ],
        }),
      ],
    });

    expect(['exact_match', 'strong_match']).toContain(plan.identity?.decision);
    expect(plan.resolvedEventId).toBe('event-g');
    expect(plan.eventAction).not.toBe('insert');
    expect(plan.sourceAction).toBe('insert');
  });

  it('H — ambiguous match requires review', () => {
    const result = matchEventToCatalog(
      candidate({ title: 'Rave Night', startsAt: '2027-08-21T22:00:00+02:00', venueCity: 'Köln' }),
      [catalogEntry({ eventId: 'event-h', title: 'Rave Night Special', startsAt: '2027-08-22T01:00:00+02:00', venueCity: 'Köln', venueName: undefined })],
    );
    expect(result.decision).toBe('review_required');
    expect(result.autoBindAllowed).toBe(false);
  });

  it('I — same day same venue but different event window', () => {
    const result = matchEventToCatalog(
      candidate({ title: 'Floor 1: Techno', startsAt: '2027-08-21T18:00:00+02:00', venueName: 'Bootshaus', venueCity: 'Köln' }),
      [catalogEntry({ eventId: 'event-i', title: 'Floor 2: House', startsAt: '2027-08-21T23:30:00+02:00', venueName: 'Bootshaus', venueCity: 'Köln' })],
    );
    expect(result.decision).toBe('no_match');
  });

  it('J — rescheduled event with existing external binding', () => {
    const result = matchEventToCatalog(
      candidate({
        title: 'Loonyland',
        startsAt: '2027-08-22T22:00:00+02:00',
        sourceUrl: 'https://bootshaus.tv/events/loonyland/',
        connectorId: 'bootshaus-official',
        sourceEventKey: 'loonyland',
      }),
      [
        catalogEntry({
          eventId: 'event-j',
          title: 'Loonyland',
          startsAt: '2027-08-21T22:00:00+02:00',
          sourceBindings: [
            {
              sourceId: 'source-j',
              eventId: 'event-j',
              sourceRole: 'official',
              sourceUrl: 'https://bootshaus.tv/events/loonyland/',
              connectorId: 'bootshaus-official',
              sourceEventKey: 'loonyland',
            },
          ],
        }),
      ],
    );
    expect(result.decision).toBe('exact_match');
    expect(result.candidateEventId).toBe('event-j');
  });

  it('K — multi-source resolves to one canonical event', () => {
    const plans = planOfficialEventWrites(
      [
        officialEvidenceToEventCandidate(evidence({
          sourceEventKey: 'nibirii-2027',
          officialUrl: 'https://nibirii.de/events/official/',
          title: 'Nibirii Festival 2027',
          startsAt: '2027-07-17T14:00:00+02:00',
          pageFingerprint: 'fp-1',
        })),
        officialEvidenceToEventCandidate(evidence({
          sourceEventKey: 'nibirii-venue',
          officialUrl: 'https://bootshaus.tv/events/nibirii-2027/',
          title: 'Nibirii 2027',
          startsAt: '2027-07-17T14:00:00+02:00',
          pageFingerprint: 'fp-2',
        })),
        officialEvidenceToEventCandidate(evidence({
          sourceEventKey: 'nibirii-organizer',
          officialUrl: 'https://organizer.example/nibirii-2027/',
          title: 'Nibirii Festival',
          startsAt: '2027-07-17T14:00:00+02:00',
          pageFingerprint: 'fp-3',
        })),
      ],
      { existingSources: [], existingVenues: [] },
    );

    expect(plans[0]?.eventAction).toBe('insert');
    expect(plans[1]?.identity?.decision).toBe('strong_match');
    expect(plans[2]?.identity?.decision).toBe('strong_match');
    expect(plans[1]?.sourceAction).toBe('insert');
    expect(plans[2]?.sourceAction).toBe('insert');
    expect(new Set(plans.map((plan) => plan.resolvedEventId ?? 'new')).size).toBe(2);
  });

  it('L — duplicate source observation does not create duplicate binding plan', () => {
    const candidateEvent = officialEvidenceToEventCandidate(evidence({
      sourceEventKey: 'loonyland',
      officialUrl: 'https://bootshaus.tv/events/loonyland/',
      title: 'Loonyland',
      startsAt: '2027-08-21T22:00:00+02:00',
      pageFingerprint: 'fp-same',
    }));
    const first = planOfficialEventWrite(candidateEvent, {
      existingSources: [
        {
          sourceId: 'source-l',
          eventId: 'event-l',
          sourceUrl: 'https://bootshaus.tv/events/loonyland/',
          contentHash: 'fp-same',
        },
      ],
      existingVenues: [],
      existingEvents: [
        {
          eventId: 'event-l',
          title: 'Loonyland',
          description: null,
          startsAt: '2027-08-21T22:00:00+02:00',
          endsAt: null,
          timezone: 'Europe/Berlin',
          organizerName: null,
          imageUrl: null,
          venueId: null,
          status: 'published',
          lineup: [],
          genres: [],
        },
      ],
      eventCatalog: [
        catalogEntry({
          eventId: 'event-l',
          title: 'Loonyland',
          startsAt: '2027-08-21T22:00:00+02:00',
          sourceBindings: [
            {
              sourceId: 'source-l',
              eventId: 'event-l',
              sourceRole: 'official',
              sourceUrl: 'https://bootshaus.tv/events/loonyland/',
            },
          ],
        }),
      ],
    });
    const second = planOfficialEventWrite(candidateEvent, {
      existingSources: [
        {
          sourceId: 'source-l',
          eventId: 'event-l',
          sourceUrl: 'https://bootshaus.tv/events/loonyland/',
          contentHash: 'fp-same',
        },
      ],
      existingVenues: [],
      existingEvents: [
        {
          eventId: 'event-l',
          title: 'Loonyland',
          description: null,
          startsAt: '2027-08-21T22:00:00+02:00',
          endsAt: null,
          timezone: 'Europe/Berlin',
          organizerName: null,
          imageUrl: null,
          venueId: null,
          status: 'published',
          lineup: [],
          genres: [],
        },
      ],
      eventCatalog: [
        catalogEntry({
          eventId: 'event-l',
          title: 'Loonyland',
          startsAt: '2027-08-21T22:00:00+02:00',
          sourceBindings: [
            {
              sourceId: 'source-l',
              eventId: 'event-l',
              sourceRole: 'official',
              sourceUrl: 'https://bootshaus.tv/events/loonyland/',
            },
          ],
        }),
      ],
    });

    expect(first.identity?.decision).toBe('exact_match');
    expect(isPlanIdempotent(first)).toBe(true);
    expect(isPlanIdempotent(second)).toBe(true);
    expect(second.sourceAction).toBe('noop');
  });
});

describe('false-positive guard metrics', () => {
  it('reports zero false-positive merges across negative fixtures', () => {
    const negativeCases = [
      { candidate: candidate({ title: 'Nibirii Festival 2027', startsAt: '2027-07-17T14:00:00+02:00' }), catalog: [catalogEntry({ eventId: '1', title: 'Nibirii Festival 2026', startsAt: '2026-07-17T14:00:00+02:00' })] },
      { candidate: candidate({ title: 'UNREAL', startsAt: '2027-08-30T23:00:00+02:00' }), catalog: [catalogEntry({ eventId: '2', title: 'UNREAL', startsAt: '2027-09-06T23:00:00+02:00' })] },
      { candidate: candidate({ title: 'Techno Night', startsAt: '2027-08-21T22:00:00+02:00', venueName: 'Bootshaus' }), catalog: [catalogEntry({ eventId: '3', title: 'Techno Night', startsAt: '2027-08-21T22:00:00+02:00', venueName: 'Odonien' })] },
      { candidate: candidate({ title: 'Floor 1', startsAt: '2027-08-21T18:00:00+02:00' }), catalog: [catalogEntry({ eventId: '4', title: 'Floor 2', startsAt: '2027-08-21T23:30:00+02:00' })] },
    ];

    let falsePositiveMerges = 0;
    let exactMatches = 0;
    let strongMatches = 0;
    let reviewRequiredMatches = 0;
    let noMatches = 0;

    for (const negativeCase of negativeCases) {
      const result = matchEventToCatalog(negativeCase.candidate, negativeCase.catalog);
      if (result.decision === 'exact_match') exactMatches += 1;
      if (result.decision === 'strong_match') strongMatches += 1;
      if (result.decision === 'review_required' || result.decision === 'possible_match') reviewRequiredMatches += 1;
      if (result.decision === 'no_match') noMatches += 1;
      if ((result.decision === 'exact_match' || result.decision === 'strong_match') && result.autoBindAllowed) {
        falsePositiveMerges += 1;
      }
    }

    expect(falsePositiveMerges).toBe(0);
    expect(exactMatches).toBe(0);
    expect(strongMatches).toBe(0);
  });
});
