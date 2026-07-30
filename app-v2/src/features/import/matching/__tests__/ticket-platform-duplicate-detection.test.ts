import { describe, expect, it } from 'vitest';

import { duplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

describe('duplicate detection for ticket platform enrichment', () => {
  const catalog: MatchingCatalog = {
    events: [
      {
        id: 'evt-play-open-air',
        title: 'PLAY! Open Air',
        startDate: '2026-08-01T12:00:00.000Z',
        venueId: 'venue-bootshaus-koeln',
        venueName: 'Bootshaus',
        latitude: 50.9517133,
        longitude: 6.9819222,
      },
    ],
    venues: [],
    cities: [],
    genres: [],
    artists: [],
    organizers: [],
  };

  const ticketCandidate: NormalizedEventCandidate = {
    externalId: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
    title: 'PLAY! Open Air – Bootshaus Köln',
    startDate: '2026-08-01T14:00:00+02:00',
    venueName: 'Bootshaus',
    latitude: 50.9517133,
    longitude: 6.9819222,
    ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
    rawSourceType: 'json_ld',
    sourceMetadata: { enrichmentSource: true },
  };

  it('matches enrichment events to existing Bootshaus canonical events', () => {
    const result = duplicateDetectionService.detect(
      ticketCandidate,
      catalog,
      'venue-bootshaus-koeln',
    );

    expect(result.duplicateScore).toBeGreaterThanOrEqual(70);
    expect(result.duplicateEventId).toBe('evt-play-open-air');
    expect(result.isDuplicate).toBe(true);
  });
});
