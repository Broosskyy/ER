import { describe, expect, it } from 'vitest';

import { duplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import {
  evaluateEventOwnershipMatch,
  importRecordMayContributeLineup,
} from '@/features/import/matching/event-ownership-decision';
import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { matchingConfig } from '@/features/import/matching/matching-config';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

const catalog = createTestMatchingCatalog();

describe('event ownership decision', () => {
  it('rejects severe title conflict with ticket URL conflict', () => {
    const candidate: NormalizedEventCandidate = {
      externalId: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt/',
      title: 'MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION',
      startDate: '2026-08-15T21:00:00.000Z',
      venueName: 'Essigfabrik',
      artistNames: ['DYSTOPIA', 'VALKYRIE'],
      rawSourceType: 'html',
    };
    const event = catalog.events[0]!;
    const decision = evaluateEventOwnershipMatch({
      candidate: {
        ...candidate,
        title: 'Into The Madness Pre-Party Weekender w. RAN - D and more!',
        externalId: 'https://bootshaus-club.ticket.io/BcDqml12/',
      },
      event: {
        ...event,
        title: 'MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION',
        externalId: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt/',
        artistNames: ['DYSTOPIA', 'VALKYRIE'],
      },
    });
    expect(decision.conflictSignals.length).toBeGreaterThan(0);
    expect(decision.accepted).toBe(false);
  });

  it('does not match events on artist overlap alone', () => {
    const result = duplicateDetectionService.detect(
      {
        externalId: 'unique-madness',
        title: 'Into The Madness Pre-Party Weekender',
        startDate: '2026-08-15T21:00:00.000Z',
        venueName: 'Essigfabrik',
        artistNames: ['DYSTOPIA', 'VALKYRIE', 'IAN CRANK'],
        rawSourceType: 'html',
      },
      {
        ...catalog,
        events: [
          {
            ...catalog.events[0]!,
            id: 'evt-mdma',
            title: 'MDMA- Musik Die Mich Antreibt',
            startDate: '2026-08-15T21:00:00.000Z',
            venueName: 'Essigfabrik',
            artistNames: ['DYSTOPIA', 'VALKYRIE', 'IAN CRANK'],
            externalId: 'https://ticketkings.de/event/mdma/',
          },
        ],
      },
      'venue-1',
    );
    expect(result.duplicateScore).toBeLessThan(matchingConfig.duplicateThreshold);
    expect(result.isDuplicate).toBe(false);
  });

  it('blocks lineup contribution when record title diverges from event', () => {
    const allowed = importRecordMayContributeLineup({
      recordTitle: 'MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION',
      recordExternalUrls: ['https://ticketkings.de/event/mdma-musik-die-mich-antreibt/'],
      eventTitle: 'Into The Madness Pre-Party Weekender w. RAN - D and more!',
      eventWebsiteUrl: 'https://bootshaus.tv/events/into-the-madness-pre-party-weekender-w-ran-d-and-more',
    });
    expect(allowed).toBe(false);
  });

  it('accepts title date venue ownership for catalog fixture', () => {
    const candidate: NormalizedEventCandidate = {
      externalId: 'new-1',
      title: 'Techno Night',
      startDate: '2026-08-15T20:00:00.000Z',
      venueName: 'Bootshaus',
      artistNames: ['Ben Klock'],
      rawSourceType: 'json_ld',
    };
    const event = catalog.events[0]!;
    const ownership = evaluateEventOwnershipMatch({
      candidate,
      event,
      matchedVenueId: 'venue-1',
    });
    expect(ownership.conflictSignals).toEqual([]);
    const result = duplicateDetectionService.detect(candidate, catalog, 'venue-1');
    expect(result.duplicateScore).toBeGreaterThanOrEqual(matchingConfig.scores.titleDateVenue);
  });
});
