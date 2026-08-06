import { describe, expect, it } from 'vitest';

import { duplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

describe('duplicate detection for ticket kings enrichment', () => {
  const catalog: MatchingCatalog = {
    events: [
      {
        id: 'evt-mdma-edition',
        title: 'MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION',
        startDate: '2026-08-15T21:00:00.000Z',
        venueId: 'venue-essigfabrik-koeln',
        venueName: 'Essigfabrik',
        ticketUrl: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/',
      },
    ],
    venues: [],
    cities: [],
    genres: [],
    artists: [],
    organizers: [],
  };

  const ticketCandidate: NormalizedEventCandidate = {
    externalId: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/',
    title: 'MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION',
    startDate: '2026-08-15T23:00:00+02:00',
    venueName: 'Essigfabrik',
    ticketUrl: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/',
    rawSourceType: 'json_ld',
    sourceMetadata: { enrichmentSource: true, platform: 'ticket_king' },
  };

  it('matches ticket kings enrichment events via ticket URL and title', () => {
    const result = duplicateDetectionService.detect(
      ticketCandidate,
      catalog,
      'venue-essigfabrik-koeln',
    );

    expect(result.duplicateScore).toBeGreaterThanOrEqual(70);
    expect(result.duplicateEventId).toBe('evt-mdma-edition');
    expect(result.isDuplicate).toBe(true);
  });

  it('matches enrichment events when venue label differs by suffix (Essigfabrik / Elektroküche)', () => {
    const websiteCatalog: MatchingCatalog = {
      ...catalog,
      events: [
        {
          id: 'evt-mdma-website',
          title: 'MDMA- Musik Die Mich Antreibt xxx F2F & B2B xxx EDITION',
          startDate: '2026-08-15T21:00:00.000Z',
          venueName: 'Essigfabrik / Elektroküche',
          ticketUrl: 'https://affenkaefig.info/event/mdma-edition/',
        },
      ],
    };

    const result = duplicateDetectionService.detect(
      ticketCandidate,
      websiteCatalog,
      undefined,
    );

    expect(result.duplicateScore).toBeGreaterThanOrEqual(70);
    expect(result.duplicateEventId).toBe('evt-mdma-website');
    expect(result.isDuplicate).toBe(true);
  });
});
