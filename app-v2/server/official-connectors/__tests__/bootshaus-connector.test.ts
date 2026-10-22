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

  it('does not reject the official blu|white 2027 event for a prior-year end-date typo', () => {
    const html = `<div class="event-details-container">
      <div><h4>Begin</h4>30.01.2027 18:30</div>
      <div><h4>End</h4>31.12.2026 03:00</div>
      <div><h4>Location</h4>Bootshaus<br>Auenweg 173, 51063 Köln</div>
    </div>
    <div class="upcoming-title">blu|white 2027 - KARNEVAL MEETS CLUBBING</div>
    <div class="event-description-content">
      <p>Karneval goes clubbing vol. 9 mit drei Bands und elektronischer Musik.</p>
      <p>Mainfloor:</p><p>Kasalla</p><p>Cat Ballou</p><p>Brings</p>
    </div>`;
    const countersLocal = createEmptyConnectorCounters();
    const evidence = parseBootshausDetailPage(html,
      'https://bootshaus.tv/events/blu-white-2027-karneval-meets-clubbing/',
      '2026-10-22T18:00:00Z',countersLocal);
    expect(evidence.startsAt).toBe('2027-01-30T18:30:00+01:00');
    expect(evidence.endsAt).toBeUndefined();
    expect(evidence.enrichmentGaps).toContain('unverified_end_time_source_conflict');
    expect(countersLocal.endBeforeStart).toBe(0);
    expect(evidence.venue?.city).toBe('Köln');
  });

  it('retains valid overnight end times unchanged', () => {
    const html = `<div class="event-details-container">
      <div><h4>Begin</h4>30.01.2027 18:30</div>
      <div><h4>End</h4>31.01.2027 03:00</div>
      <div><h4>Location</h4>Bootshaus<br>Auenweg 173, 51063 Köln</div>
    </div><div class="upcoming-title">Test party</div>`;
    const evidence=parseBootshausDetailPage(html,
      'https://bootshaus.tv/events/blu-white-2027-karneval-meets-clubbing/',
      '2026-10-22T18:00:00Z',createEmptyConnectorCounters());
    expect(evidence.endsAt).toBe('2027-01-31T03:00:00+01:00');
    expect(evidence.enrichmentGaps).not.toContain('unverified_end_time_source_conflict');
  });

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
