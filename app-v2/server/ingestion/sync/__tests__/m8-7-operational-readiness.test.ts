import { describe, expect, it } from 'vitest';

import { matchEventToCatalog } from '../../identity/event-matcher';
import type { EventMatchCatalogEntry, EventMatchCandidateInput } from '../../identity/event-match-types';
import {
  PRODUCTION_SCHEDULER_ENABLED,
  STAGING_SCHEDULER_ENABLED,
} from '../scheduler-boundary';
import { createEmptySyncRunCounters } from '../types';
import { isContentReviewOnlyRun } from '../health';

function catalogEntry(
  overrides: Partial<EventMatchCatalogEntry> & Pick<EventMatchCatalogEntry, 'eventId' | 'title' | 'startsAt'>,
): EventMatchCatalogEntry {
  return {
    timezone: 'Europe/Berlin',
    lineupBillingNames: [],
    sourceBindings: [],
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    organizerName: 'Affenkaefig',
    ...overrides,
  };
}

function candidate(
  overrides: Partial<EventMatchCandidateInput> & Pick<EventMatchCandidateInput, 'title' | 'startsAt'>,
): EventMatchCandidateInput {
  return {
    timezone: 'Europe/Berlin',
    lineupBillingNames: [],
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    connectorId: 'affenkaefig-official',
    sourceEventKey: 'affenkaefigrulesbootshaus-koeln-23-10-26',
    sourceUrl: 'https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/',
    organizerName: 'Affenkaefig',
    ...overrides,
  };
}

describe('M8.7 operational readiness', () => {
  it('keeps production scheduler disabled while staging scheduler is enabled', () => {
    expect(STAGING_SCHEDULER_ENABLED).toBe(true);
    expect(PRODUCTION_SCHEDULER_ENABLED).toBe(false);
  });

  it('treats single review event as non-blocking for technical health', () => {
    const counters = createEmptySyncRunCounters();
    counters.reviewRequired = 1;
    counters.planned = 7;
    counters.parsed = 7;
    expect(isContentReviewOnlyRun('partially_succeeded', counters, ['reconciliation_review'])).toBe(true);
  });

  it('investigates AFFENKÄFIG RULES cross-source case without unsafe auto-merge', () => {
    const result = matchEventToCatalog(
      candidate({
        title: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
        startsAt: '2026-10-23T00:00:00+02:00',
      }),
      [
        catalogEntry({
          eventId: 'bootshaus-event',
          title: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
          startsAt: '2026-10-23T23:00:00+02:00',
          sourceBindings: [
            {
              sourceId: 'source-bootshaus',
              eventId: 'bootshaus-event',
              sourceRole: 'official',
              sourceUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
              connectorId: 'bootshaus-official',
              sourceEventKey: 'affenkaefig-rules-bootshaus-koeln',
            },
          ],
        }),
      ],
    );

    expect(result.decision).toBe('review_required');
    expect(result.autoBindAllowed).toBe(false);
    expect(result.candidateEventId).toBe('bootshaus-event');
    expect(result.reasons).toContain('possible_match_requires_review');
    expect(result.signals.some((entry) => entry.signal === 'datetime')).toBe(true);
  });
});
