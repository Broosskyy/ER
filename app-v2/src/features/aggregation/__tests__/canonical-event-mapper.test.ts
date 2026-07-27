import { describe, expect, it } from 'vitest';

import {
  extractTimeLabel,
  mapNormalizedCandidateToCanonical,
} from '@/features/aggregation/domain/canonical-import-event';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

function candidate(): NormalizedEventCandidate {
  return {
    externalId: 'evt-1',
    title: 'Warehouse Rave',
    description: 'Techno all night',
    startDate: '2026-09-12T22:00:00.000Z',
    endDate: '2026-09-13T06:00:00.000Z',
    venueName: 'Warehouse',
    cityName: 'Berlin',
    countryCode: 'DE',
    genreNames: ['Techno'],
    artistNames: ['DJ Alpha'],
    organizerName: 'Night Crew',
    ticketUrl: 'https://tickets.example/event-1',
    imageUrl: 'https://img.example/cover.jpg',
    priceAmount: 25,
    priceCurrency: 'EUR',
    rawSourceType: 'api_json',
  };
}

describe('canonical import event mapper', () => {
  it('maps normalized candidates to canonical import events', () => {
    const canonical = mapNormalizedCandidateToCanonical(candidate(), {
      id: 'source-ra',
      name: 'Resident Advisor',
    });

    expect(canonical.sourceId).toBe('source-ra');
    expect(canonical.sourceName).toBe('Resident Advisor');
    expect(canonical.title).toBe('Warehouse Rave');
    expect(canonical.priceAmount).toBe(25);
    expect(canonical.imageUrls).toEqual(['https://img.example/cover.jpg']);
    expect(canonical.startTime).toBe('22:00');
  });

  it('extracts time labels from ISO dates', () => {
    expect(extractTimeLabel('2026-09-12T22:00:00.000Z')).toBe('22:00');
  });
});
