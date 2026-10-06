import { describe, expect, it } from 'vitest';

import { createEmptyConnectorCounters } from '../types';
import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import { dedupeDetailUrls, extractBootshausDetailUrlsFromListHtml } from '../bootshaus/parse-list';
import {
  BOOTSHAUS_AFFENKAEFIG_FRAGMENT,
  BOOTSHAUS_CHRIS_FRAGMENT,
  BOOTSHAUS_DETAIL_FRAGMENT,
  BOOTSHAUS_LIST_FRAGMENT,
} from './fixtures/bootshaus-fragments';

describe('bootshaus list parsing', () => {
  it('recognizes detail links and deduplicates them', () => {
    const urls = extractBootshausDetailUrlsFromListHtml(BOOTSHAUS_LIST_FRAGMENT);
    expect(urls).toHaveLength(2);
    const deduped = dedupeDetailUrls([...urls, ...urls]);
    expect(deduped.uniqueUrls).toHaveLength(2);
    expect(deduped.duplicateCount).toBe(2);
  });
});

describe('bootshaus detail parsing', () => {
  const counters = createEmptyConnectorCounters();

  it('parses loonyland control case', () => {
    const evidence = parseBootshausDetailPage(
      BOOTSHAUS_DETAIL_FRAGMENT,
      'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie/',
      '2026-08-14T12:00:00.000Z',
      counters,
    );

    expect(evidence.startsAt).toBe('2026-08-21T22:00:00+02:00');
    expect(evidence.endsAt).toBe('2026-08-22T05:00:00+02:00');
    expect(evidence.venue?.name).toBe('Bootshaus');
    expect(evidence.venue?.city).toBe('Köln');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
    expect(evidence.lineupCandidates[1]?.evidenceRole).toBe('compound_act');
    expect(evidence.explicitGenreLabels).toEqual([]);
    expect(evidence.enrichmentGaps).toContain('genres_missing');
    expect(evidence.linkedTicketUrl).toMatch(/^https:\/\/bootshaus-club\.ticket\.io\//);
    expect(evidence.descriptionClean).not.toContain('Bootshaus Mobile App');
    expect(evidence.descriptionClean).not.toContain('Auenweg 173');
    expect(evidence.descriptionClean).not.toContain('snash.com');
  });

  it('parses chris stussy control case', () => {
    const evidence = parseBootshausDetailPage(
      BOOTSHAUS_CHRIS_FRAGMENT,
      'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus/',
      '2026-08-14T12:00:00.000Z',
      counters,
    );

    expect(evidence.startsAt).toBe('2026-10-16T22:00:00+02:00');
    expect(evidence.endsAt).toBe('2026-10-17T05:00:00+02:00');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual(['CHRIS STUSSY']);
    expect(evidence.explicitGenreLabels).toEqual([]);
  });

  it('parses affenkaefig control case without inventing lineup or genres', () => {
    const evidence = parseBootshausDetailPage(
      BOOTSHAUS_AFFENKAEFIG_FRAGMENT,
      'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
      '2026-08-14T12:00:00.000Z',
      counters,
    );

    expect(evidence.startsAt).toBe('2026-10-23T23:00:00+02:00');
    expect(evidence.endsAt).toBe('2026-10-24T07:00:00+02:00');
    expect(evidence.lineupCandidates).toEqual([]);
    expect(evidence.enrichmentGaps).toContain('lineup_not_announced');
    expect(evidence.enrichmentGaps).toContain('genres_missing');
    expect(evidence.descriptionClean).not.toContain('Bootshaus Mobile App');
    expect(evidence.descriptionClean).not.toContain('Auenweg 173');
    expect(evidence.descriptionClean).not.toContain('snash.com');
    expect(evidence.descriptionClean).not.toContain('Early Bird');
  });
});
