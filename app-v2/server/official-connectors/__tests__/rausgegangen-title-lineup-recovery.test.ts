import { describe, expect, it } from 'vitest';

import { buildOfficialEvidenceFromRausgegangenEnriched } from '../rausgegangen-discovery/rausgegangen-controlled-import-bridge';
import { extractVerifiedTitleLineupCandidates } from '../shared/title-lineup-evidence';
import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';

describe('Rausgegangen title lineup recovery', () => {
  it('extracts explicit w/ multi-act billing without venue or more noise', () => {
    const ascension = extractVerifiedTitleLineupCandidates({
      eventTitle:
        'Ascension w/ Limoncello, Hotboi2300, Oskamaxx, Patrick Schumm & more at Helios37',
    });
    expect(ascension.candidates.map((act) => act.displayName)).toEqual([
      'Limoncello',
      'Hotboi2300',
      'Oskamaxx',
      'Patrick Schumm',
    ]);

    const birthday = extractVerifiedTitleLineupCandidates({
      eventTitle: '12 Jahre Richtig DICK Techno! w/ Zeuz, Tommy Libera',
    });
    expect(birthday.candidates.map((act) => act.displayName)).toEqual([
      'Zeuz',
      'Tommy Libera',
    ]);

    const weiberfastnacht = extractVerifiedTitleLineupCandidates({
      eventTitle: 'Weiberfastnacht im Bootshaus /w Trash Island, Mickie Krause & more',
    });
    expect(weiberfastnacht.candidates.map((act) => act.displayName)).toEqual([
      'Trash Island',
      'Mickie Krause',
    ]);
  });

  it('accepts only clearly formatted German show billing after mit', () => {
    const extracted = extractVerifiedTitleLineupCandidates({
      eventTitle:
        'Feiern wie früher - nur früher! Der Daytime Rave mit ANNA REUSCH & THOMAS SCHUMACHER',
    });
    expect(extracted.candidates.map((act) => act.displayName)).toEqual([
      'ANNA REUSCH',
      'THOMAS SCHUMACHER',
    ]);

    const prose = extractVerifiedTitleLineupCandidates({
      eventTitle: 'Eine Nacht mit guter Musik und Freunden',
    });
    expect(prose.candidates).toHaveLength(0);
  });

  it('promotes verified title billing into normal Rausgegangen evidence', () => {
    const enriched = {
      identityKey: 'rausgegangen:ascension',
      ticketIoEventId: 'ascension',
      shopId: 'rausgegangen:koeln',
      shopSlug: 'koeln',
      listingUrl: 'https://rausgegangen.de/koeln/',
      eventUrl: 'https://rausgegangen.de/events/ascension/',
      canonicalUrl: 'https://rausgegangen.de/events/ascension/',
      title: 'Ascension w/ Limoncello, Hotboi2300, Oskamaxx, Patrick Schumm & more at Helios37',
      startsAt: '2026-10-16T21:00:00.000Z',
      endsAt: '2026-10-17T05:30:00.000Z',
      lifecycle: 'UPCOMING',
      venueName: 'Helios37',
      city: 'Köln',
      lineupHints: [],
      genreHints: ['Techno'],
      genreCandidates: [{ label: 'Techno', confidence: 'explicit' }],
      outboundLinks: [],
      verifiedOutbound: [],
      imageUrls: ['https://example.com/flyer.jpg'],
      mediaRoles: [],
      products: [],
      ticketAvailability: 'UNKNOWN',
      ticketAction: 'NONE',
      detailAccess: 'DETAIL_ACCESSIBLE',
      fetchMethod: 'fetch',
      evidenceTimestamp: '2026-10-16T00:00:00.000Z',
      relevance: 'HIGH_RELEVANCE',
      relevanceReasons: [],
      matchClassification: 'NET_NEW',
      matchReasons: [],
      qualification: 'IMPORT_CANDIDATE',
      fieldEvidence: [],
    } as unknown as EnrichedTicketIoEvent;

    const evidence = buildOfficialEvidenceFromRausgegangenEnriched(
      enriched,
      {
        ok: true,
        status: 200,
        html: '<html></html>',
        finalUrl: enriched.canonicalUrl,
        fromCache: false,
        detailAccess: 'DETAIL_ACCESSIBLE',
        fetchMethod: 'fetch',
        contentFingerprint: 'fixture',
      },
      '2026-10-16T00:00:00.000Z',
    );

    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'Limoncello',
      'Hotboi2300',
      'Oskamaxx',
      'Patrick Schumm',
    ]);
  });
});
