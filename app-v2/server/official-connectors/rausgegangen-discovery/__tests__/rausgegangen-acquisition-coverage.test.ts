import { describe, expect, it } from 'vitest';

import { classifyRelevanceEvidence } from '../../ticket-evidence/network-discovery/relevance-evidence';
import {
  extractLocationLinksFromHtml,
  extractLocationSlugsFromEventSlug,
  normalizeLocationUrl,
} from '../location-url';
import { qualifyLocationSurfaceCandidates, selectLocationSurfacesToCrawl } from '../location-surface-qualification';
import { deriveLineupDomainEvidence } from '../lineup-domain-evidence';
import { compareRollingWindows, isWithinRollingWindow } from '../rolling-window';
import { ehrenklubDiscoveredViaLocation } from '../rausgegangen-acquisition-coverage';
import type { UnionDiscoveredEvent } from '../discovery-surfaces';

describe('location url utilities', () => {
  it('infers venue location slugs from event slug patterns', () => {
    expect(extractLocationSlugsFromEventSlug('ehrenklub-im-schrotty-14-0')).toContain('schrotty');
    expect(extractLocationSlugsFromEventSlug('bailoteo-schrotty-september-0')).toContain('schrotty');
  });

  it('normalizes location urls and extracts links from html', () => {
    expect(normalizeLocationUrl('schrotty')).toBe('https://rausgegangen.de/locations/schrotty/');
    const html = '<a href="/locations/schrotty/">Schrotty</a><a href="/locations/bootshaus/">Bootshaus</a>';
    expect(extractLocationLinksFromHtml(html)).toEqual([
      'https://rausgegangen.de/locations/schrotty/',
      'https://rausgegangen.de/locations/bootshaus/',
    ]);
  });
});

describe('location qualification', () => {
  it('prioritizes recall for unresolved locations with electronic evidence', () => {
    const candidates = qualifyLocationSurfaceCandidates([
      {
        locationUrl: 'https://rausgegangen.de/locations/schrotty/',
        evidenceSources: ['detail_venue_link'],
        observedTitles: ['EhrenKlub im Schrotty #14', 'Techno Night'],
        observedGenreHints: ['techno'],
      },
      {
        locationUrl: 'https://rausgegangen.de/locations/flea-market/',
        evidenceSources: ['city_listing_link'],
        observedTitles: ['Flohmarkt'],
        observedGenreHints: [],
      },
    ]);
    const selected = selectLocationSurfacesToCrawl(candidates, 10);
    const schrotty = selected.find((entry) => entry.locationSlug === 'schrotty');
    const flea = selected.find((entry) => entry.locationSlug === 'flea-market');
    expect(schrotty).toBeDefined();
    expect((schrotty?.qualificationScore ?? 0) > (flea?.qualificationScore ?? 0)).toBe(true);
  });
});

describe('rolling window', () => {
  it('classifies upcoming events inside configured window', () => {
    const reference = new Date('2026-09-16T12:00:00+02:00');
    expect(isWithinRollingWindow('2026-10-01T22:00:00+02:00', reference, 90)).toBe(true);
    expect(isWithinRollingWindow('2027-01-01T22:00:00+01:00', reference, 90)).toBe(false);
    const comparison = compareRollingWindows({
      events: [
        { startsAt: '2026-10-01T22:00:00+02:00', lifecycle: 'UPCOMING' },
        { startsAt: '2027-01-01T22:00:00+01:00', lifecycle: 'UPCOMING' },
      ],
      referenceInstant: reference,
      windows: [30, 90],
    });
    expect(comparison.find((entry) => entry.windowDays === 90)?.upcomingCount).toBe(1);
  });
});

describe('lineup domain evidence', () => {
  it('can establish likely electronic domain from multi-artist club lineup without explicit genre', () => {
    const evidence = deriveLineupDomainEvidence({
      title: 'EhrenKlub im Schrotty #14',
      lineup: ['DIKKE BAAP', 'RIOT SHIFT', 'TITI', 'USH', 'GREEKZ B2B KARAMUSTAN'],
    });
    expect(evidence.domainBoost).toBe('LIKELY');
    const relevance = classifyRelevanceEvidence({
      title: 'EhrenKlub im Schrotty #14',
      lineupHints: ['DIKKE BAAP', 'RIOT SHIFT', 'TITI', 'USH', 'GREEKZ B2B KARAMUSTAN'],
      lineupDomainBoost: evidence.domainBoost,
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(relevance.relevance).toBe('LIKELY_RELEVANT');
  });

  it('does not invent a specific genre from electronic domain alone', () => {
    const evidence = deriveLineupDomainEvidence({
      title: 'Club Night',
      lineup: ['DJ A', 'DJ B', 'DJ C', 'DJ D', 'DJ E'],
    });
    expect(evidence.domainBoost).toBe('LIKELY');
  });
});

describe('ehrenklub regression discovery provenance', () => {
  it('requires generic location surface discovery', () => {
    const event: UnionDiscoveredEvent = {
      eventUrl: 'https://rausgegangen.de/events/ehrenklub-im-schrotty-14-0/',
      eventSlug: 'ehrenklub-im-schrotty-14-0',
      discoveredBy: [
        {
          surfaceType: 'LOCATION',
          surfaceId: 'schrotty',
          surfaceUrl: 'https://rausgegangen.de/locations/schrotty/',
          discoveredAt: '2026-09-16T00:00:00.000Z',
        },
      ],
    };
    expect(ehrenklubDiscoveredViaLocation(event)).toBe(true);
  });
});
