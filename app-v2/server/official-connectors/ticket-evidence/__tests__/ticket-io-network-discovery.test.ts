import { describe, expect, it } from 'vitest';

import { parseTicketIoShopListHtml } from '../parse-ticket-io-shop-list';
import {
  buildEventIdentityKey,
  classifyTicketIoEventLifecycle,
  dedupeNetworkDiscoveryCandidates,
  listEntryToDiscoveryCandidate,
  normalizeTicketIoEventUrl,
} from '../network-discovery/event-candidate';
import { inferGenreLabels } from '../network-discovery/genre-coverage';
import { classifyMediaUrls } from '../network-discovery/media-classifier';
import {
  buildMatchCatalogFromStaging,
  matchDiscoveryCandidateAgainstCatalog,
} from '../network-discovery/match-staging-catalog';
import { classifyOutboundUrl } from '../network-discovery/outbound-sources';
import { classifyElectronicRelevance } from '../network-discovery/relevance-classifier';
import { mergeShopSeeds, normalizeTicketIoShopUrl } from '../network-discovery/shop-seeds';
import { scoreTicketIoShops } from '../network-discovery/shop-scorer';
import type { TicketIoEventDiscoveryCandidate, TicketIoShopCandidate } from '../network-discovery/types';

function shopListHtml(events: Array<{ id: string; name: string; start: string; venue?: string; price?: number }>): string {
  const blocks = events.map(
    (event) => `{
      "@type": "MusicEvent",
      "name": ${JSON.stringify(event.name)},
      "startDate": ${JSON.stringify(event.start)},
      "location": { "@type": "Place", "name": ${JSON.stringify(event.venue ?? 'Club')}},
      "offers": {
        "@type": "Offer",
        "url": "https://bootshaus-club.ticket.io/${event.id}/",
        "price": ${event.price ?? 25},
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock"
      }
    }`,
  );
  return `<html><head><script type="application/ld+json">${JSON.stringify(blocks.map((raw) => JSON.parse(raw)))}</script></head></html>`;
}

function candidate(overrides: Partial<TicketIoEventDiscoveryCandidate>): TicketIoEventDiscoveryCandidate {
  return {
    identityKey: 'ticket_io:bootshaus-club:abc123',
    ticketIoEventId: 'abc123',
    shopId: 'bootshaus-club',
    shopSlug: 'bootshaus-club',
    title: 'Techno Night',
    startsAt: '2026-10-01T22:00:00+02:00',
    lifecycle: 'UPCOMING',
    ticketUrl: 'https://bootshaus-club.ticket.io/abc123/',
    canonicalUrl: 'https://bootshaus-club.ticket.io/abc123/',
    lineupHints: [],
    genreHints: [],
    outboundLinks: [],
    imageUrls: [],
    visibleProducts: [],
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: [],
    matchClassification: 'REVIEW_REQUIRED',
    matchReasons: [],
    mediaRoles: [],
    discoveredFromSurfaces: ['test'],
    ...overrides,
  };
}

describe('ticket.io network discovery', () => {
  it('normalizes shop URLs to canonical ticket.io roots', () => {
    expect(normalizeTicketIoShopUrl('https://bootshaus-club.ticket.io/?utm_source=test')).toBe(
      'https://bootshaus-club.ticket.io/',
    );
    expect(normalizeTicketIoShopUrl('https://bootshaus-club.ticket.io/By06xnf4/')).toBeNull();
  });

  it('normalizes event URLs and builds stable identity keys', () => {
    expect(normalizeTicketIoEventUrl('https://bootshaus-club.ticket.io/By06xnf4/?fbclid=1')).toBe(
      'https://bootshaus-club.ticket.io/By06xnf4/',
    );
    expect(buildEventIdentityKey('bootshaus-club', 'By06xnf4')).toBe('ticket_io:bootshaus-club:by06xnf4');
  });

  it('parses shop list JSON-LD into discovery candidates', () => {
    const html = shopListHtml([
      { id: 'AbCdEf12', name: 'Chris Stussy', start: '2026-11-14T23:00:00+01:00', venue: 'Bootshaus', price: 45 },
    ]);
    const parsed = parseTicketIoShopListHtml('https://bootshaus-club.ticket.io/', html);
    const discovery = listEntryToDiscoveryCandidate(
      parsed.entries[0]!,
      'https://bootshaus-club.ticket.io/',
      'bootshaus-club',
      new Date('2026-09-02T12:00:00+02:00'),
      'seed',
    );
    expect(discovery.title).toBe('Chris Stussy');
    expect(discovery.relevance).toBe('HIGH_RELEVANCE');
  });

  it('classifies electronic relevance without overfiltering house and ambiguous club nights', () => {
    expect(classifyElectronicRelevance({ title: 'Hard Techno Rave' }).relevance).toBe('HIGH_RELEVANCE');
    expect(classifyElectronicRelevance({ title: 'House Session Cologne' }).relevance).toBe('HIGH_RELEVANCE');
    expect(classifyElectronicRelevance({ title: 'Comedy Night' }).relevance).toBe('IRRELEVANT');
    expect(classifyElectronicRelevance({ title: 'Warehouse Party' }).relevance).toBe('LIKELY_RELEVANT');
    expect(classifyElectronicRelevance({ title: 'Unknown Club Gathering' }).relevance).toBe('AMBIGUOUS');
  });

  it('excludes ended events from upcoming lifecycle', () => {
    const ended = classifyTicketIoEventLifecycle(
      '2026-08-01T22:00:00+02:00',
      null,
      new Date('2026-09-02T12:00:00+02:00'),
    );
    const upcoming = classifyTicketIoEventLifecycle(
      '2026-12-01T22:00:00+01:00',
      null,
      new Date('2026-09-02T12:00:00+02:00'),
    );
    expect(ended).toBe('ENDED');
    expect(upcoming).toBe('UPCOMING');
  });

  it('dedupes same real event across multiple network surfaces without using ticket URL alone', () => {
    const left = candidate({
      identityKey: 'ticket_io:bootshaus-club:abc111',
      ticketIoEventId: 'abc111',
      title: 'ZAAGSTEP',
      startsAt: '2026-10-24T22:00:00+02:00',
      venueName: 'Bootshaus',
      ticketUrl: 'https://bootshaus-club.ticket.io/abc111/',
      discoveredFromSurfaces: ['shop'],
    });
    const right = candidate({
      identityKey: 'ticket_io:portal-srvded:xyz999',
      ticketIoEventId: 'xyz999',
      shopSlug: 'portal-srvded',
      shopId: 'portal-srvded',
      title: 'ZAAGSTEP by Dr Donk',
      startsAt: '2026-10-24T23:00:00+02:00',
      venueName: 'Bootshaus',
      ticketUrl: 'https://portal.srvded.ticket.io/xyz999/',
      discoveredFromSurfaces: ['portal'],
    });
    const deduped = dedupeNetworkDiscoveryCandidates([left, right]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.discoveredFromSurfaces.sort()).toEqual(['portal', 'shop']);
  });

  it('does not treat different events on same day as duplicates when only ticket URLs differ', () => {
    const left = candidate({
      identityKey: 'ticket_io:bootshaus-club:aaa111',
      ticketIoEventId: 'aaa111',
      title: 'Cosmic Gate Night',
      startsAt: '2026-10-24T22:00:00+02:00',
      venueName: 'Bootshaus',
      ticketUrl: 'https://bootshaus-club.ticket.io/aaa111/',
    });
    const right = candidate({
      identityKey: 'ticket_io:bootshaus-club:bbb222',
      ticketIoEventId: 'bbb222',
      title: 'Vertile Showcase',
      startsAt: '2026-10-24T23:30:00+02:00',
      venueName: 'Bootshaus',
      ticketUrl: 'https://bootshaus-club.ticket.io/bbb222/',
    });
    expect(dedupeNetworkDiscoveryCandidates([left, right])).toHaveLength(2);
  });

  it('matches discovery candidates against staging catalog without proposing duplicate canonical events', () => {
    const catalog = buildMatchCatalogFromStaging([
      {
        eventId: '8a8eb9b7-593e-45de-926d-2514735b86cc',
        title: 'CHRIS STUSSY',
        startsAt: '2026-11-14T23:00:00+01:00',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        ticketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
        lineupBillingNames: ['Chris Stussy'],
      },
    ]);
    const matched = matchDiscoveryCandidateAgainstCatalog(
      candidate({
        title: 'Chris Stussy',
        startsAt: '2026-11-14T23:00:00+01:00',
        venueName: 'Bootshaus',
        city: 'Köln',
        ticketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
      }),
      catalog,
    );
    expect(['EXISTING_EXACT', 'EXISTING_STRONG_MATCH']).toContain(matched.matchClassification);
    expect(matched.matchedEventId).toBe('8a8eb9b7-593e-45de-926d-2514735b86cc');
  });

  it('classifies outbound organizer and social links', () => {
    expect(classifyOutboundUrl('https://bootshaus.tv/events/chris-stussy/').role).toBe('official_organizer');
    expect(classifyOutboundUrl('https://www.instagram.com/bootshaus/').role).toBe('social');
  });

  it('classifies media evidence roles', () => {
    const roles = classifyMediaUrls([
      'https://cdn.ticket.io/companies/bootshaus/events/abc/img/lineup.jpg',
      'https://cdn.ticket.io/companies/bootshaus/logo.png',
    ]);
    expect(roles).toContain('lineup_flyer');
    expect(roles).toContain('organizer_branding');
  });

  it('merges newly discovered shop seeds from outbound links', () => {
    const merged = mergeShopSeeds(
      [
        {
          slug: 'bootshaus-club',
          canonicalUrl: 'https://bootshaus-club.ticket.io/',
          discoveryMethod: 'seed_list',
          discoveredFrom: 'seed',
        },
      ],
      ['https://new-shop.ticket.io/events/foo', 'https://bootshaus-club.ticket.io/By06xnf4/'],
      'outbound_link',
      'bootshaus-club',
    );
    expect(merged).toHaveLength(2);
    expect(merged.some((shop) => shop.slug === 'new-shop')).toBe(true);
  });

  it('infers multi-label genre coverage', () => {
    expect(inferGenreLabels('Hard Techno Rave Festival')).toEqual(
      expect.arrayContaining(['Hard Techno', 'Electronic Festival']),
    );
  });

  it('does not auto-promote mixed-inventory stadtgarten to tier 1 on raw event count', () => {
    const shop: TicketIoShopCandidate = {
      shopId: 'stadtgarten',
      slug: 'stadtgarten',
      canonicalUrl: 'https://stadtgarten.ticket.io/',
      discoveryMethod: 'seed_list',
      discoveredFrom: 'test',
      lastSeenAt: '2026-09-03T10:00:00.000Z',
      confidence: 0.95,
      status: 'ACTIVE',
    };
    const events: TicketIoEventDiscoveryCandidate[] = [
      ...Array.from({ length: 4 }, (_, index) =>
        candidate({
          shopSlug: 'stadtgarten',
          shopId: 'stadtgarten',
          identityKey: `ticket_io:stadtgarten:relevant-${index}`,
          ticketIoEventId: `relevant-${index}`,
          title: 'Techno Night',
          relevance: 'HIGH_RELEVANCE',
          matchClassification: 'NET_NEW',
          startsAt: '2026-12-01T20:00:00+01:00',
          venueName: 'Stadtgarten',
          city: 'Köln',
          listAmountMinor: 1500,
          listTicketStatus: 'available',
          visibleProducts: [{ productName: 'list_minimum', amountMinor: 1500, availability: 'available' }],
        }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        candidate({
          shopSlug: 'stadtgarten',
          shopId: 'stadtgarten',
          identityKey: `ticket_io:stadtgarten:other-${index}`,
          ticketIoEventId: `other-${index}`,
          title: 'Jazz Matinee',
          relevance: 'AMBIGUOUS',
          matchClassification: 'REVIEW_REQUIRED',
          startsAt: '2026-12-02T20:00:00+01:00',
          venueName: 'Stadtgarten',
        }),
      ),
    ];

    const [score] = scoreTicketIoShops([shop], events);
    expect(score?.tier).toBe('TIER_2_ENABLE_LATER');
    expect(score?.tierReasons).toContain('mixed_inventory_shop_cap');
  });
});
