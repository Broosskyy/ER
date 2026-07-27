import { describe, expect, it } from 'vitest';

import { ScoreBasedDuplicateStrategy } from '@/features/aggregation/duplicate/duplicate-strategy';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { MatchingCatalog } from '@/features/import/matching/match-result';

function event(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'evt-new',
    sourceId: 'source-1',
    sourceName: 'Shotgun',
    title: 'Warehouse Session',
    startDate: '2026-09-12T22:00:00.000Z',
    venueName: 'Warehouse',
    cityName: 'Berlin',
    rawSourceType: 'api_json',
    ...overrides,
  };
}

const catalog: MatchingCatalog = {
  cities: [],
  venues: [],
  organizers: [],
  artists: [],
  genres: [],
  events: [
    {
      id: 'existing-1',
      title: 'Warehouse Session',
      startDate: '2026-09-12T22:00:00.000Z',
      venueName: 'Warehouse',
      cityName: 'Berlin',
      artistNames: [],
    },
  ],
};

describe('duplicate strategy', () => {
  it('flags likely duplicates using title, date and venue signals', () => {
    const strategy = new ScoreBasedDuplicateStrategy();
    const result = strategy.compare(event(), catalog);

    expect(result.isDuplicate).toBe(true);
    expect(result.duplicateEventId).toBe('existing-1');
    expect(result.comparedFields).toContain('title');
    expect(result.comparedFields).toContain('venue');
  });

  it('does not flag events on different dates', () => {
    const strategy = new ScoreBasedDuplicateStrategy();
    const result = strategy.compare(
      event({ startDate: '2026-10-12T22:00:00.000Z', title: 'Different Night' }),
      catalog,
    );

    expect(result.isDuplicate).toBe(false);
  });
});
