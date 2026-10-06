import { describe, expect, it } from 'vitest';

import { buildGermanyShopSeeds } from '../network-discovery/germany-shop-seeds';
import {
  allBundeslaender,
  buildCoverageByState,
  classifyShopGeography,
  inferCityFromGermanText,
  normalizeGermanCity,
} from '../network-discovery/germany-geography';
import { enrichShopWithGeography } from '../network-discovery/ticket-io-germany-network-discovery';
import { selectControlledImportBatch } from '../network-discovery/controlled-batch-selection';
import { evaluateImportCandidateQualityContract } from '../network-discovery/import-quality-contract-gate';
import type { EnrichedTicketIoEvent } from '../network-discovery/detail-types';
import type { TicketIoEventDiscoveryCandidate, TicketIoShopCandidate } from '../network-discovery/types';

function shop(overrides: Partial<TicketIoShopCandidate>): TicketIoShopCandidate {
  return {
    shopId: 'test-shop',
    slug: 'test-shop',
    canonicalUrl: 'https://test-shop.ticket.io/',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'test',
    lastSeenAt: '2026-09-13T12:00:00Z',
    confidence: 0.9,
    status: 'ACTIVE',
    ...overrides,
  };
}

function event(overrides: Partial<TicketIoEventDiscoveryCandidate>): TicketIoEventDiscoveryCandidate {
  return {
    identityKey: 'ticket_io:test:abc',
    ticketIoEventId: 'abc',
    shopId: 'test-shop',
    shopSlug: 'test-shop',
    title: 'Techno Night',
    lifecycle: 'UPCOMING',
    ticketUrl: 'https://test-shop.ticket.io/abc/',
    canonicalUrl: 'https://test-shop.ticket.io/abc/',
    lineupHints: [],
    genreHints: ['Techno'],
    outboundLinks: [],
    imageUrls: [],
    visibleProducts: [],
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: [],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    mediaRoles: [],
    discoveredFromSurfaces: ['test'],
    ...overrides,
  };
}

function enriched(overrides: Partial<EnrichedTicketIoEvent>): EnrichedTicketIoEvent {
  return {
    identityKey: 'ticket_io:test:abc',
    ticketIoEventId: 'abc',
    shopId: 'test-shop',
    shopSlug: 'test-shop',
    listingUrl: 'https://test-shop.ticket.io/',
    eventUrl: 'https://test-shop.ticket.io/abc/',
    canonicalUrl: 'https://test-shop.ticket.io/abc/',
    title: 'Techno Night Berlin',
    startsAt: '2026-10-15T22:00:00+02:00',
    lifecycle: 'UPCOMING',
    venueName: 'Club XYZ',
    city: 'Berlin',
    descriptionQualification: 'FULL_DESCRIPTION',
    lineupHints: ['DJ Test'],
    lineupQualification: 'FULL_LINEUP',
    genreHints: ['Techno'],
    genreCandidates: [{ label: 'Techno', confidence: 'explicit' }],
    outboundLinks: [],
    verifiedOutbound: [],
    imageUrls: ['https://cdn.ticket.io/flyer.jpg'],
    mediaRoles: ['event_flyer'],
    bestMediaUrl: 'https://cdn.ticket.io/flyer.jpg',
    products: [],
    ticketAvailability: 'AVAILABLE',
    ticketAction: 'PURCHASE',
    currentAdmissionPriceMinor: 2500,
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: ['strong_positive:techno'],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    detailAccess: 'DETAIL_ACCESSIBLE',
    qualification: 'IMPORT_CANDIDATE',
    importReadinessScore: 85,
    ...overrides,
  };
}

describe('Germany geography', () => {
  it('normalizes German city aliases', () => {
    expect(normalizeGermanCity('Cologne')?.canonical).toBe('Köln');
    expect(normalizeGermanCity('Munich')?.bundesland).toBe('Bayern');
    expect(normalizeGermanCity('Berlin')?.stateCode).toBe('DE-BE');
  });

  it('infers cities from venue and address text', () => {
    expect(inferCityFromGermanText('Live at Watergate Berlin')).toBe('Berlin');
    expect(inferCityFromGermanText('Gewölbe Köln')).toBe('Köln');
  });

  it('classifies shop geography from event evidence not language alone', () => {
    const result = classifyShopGeography({
      seedCity: 'Berlin',
      eventCities: ['Berlin'],
      venueNames: ['Watergate'],
    });
    expect(result.country).toBe('DE');
    expect(result.bundesland).toBe('Berlin');
    expect(result.confidence).toBe('HIGH');
  });

  it('does not classify as German from German text without location evidence', () => {
    const result = classifyShopGeography({
      venueNames: ['Techno Nacht'],
    });
    expect(result.country).toBeUndefined();
    expect(result.confidence).toBe('UNKNOWN');
  });

  it('builds coverage by Bundesland', () => {
    const coverage = buildCoverageByState([
      { bundesland: 'Berlin', shopCount: 2, upcomingEvents: 10, electronicCandidates: 5, netNewCandidates: 3 },
      { bundesland: 'Bayern', shopCount: 1, upcomingEvents: 4, electronicCandidates: 2, netNewCandidates: 1 },
    ]);
    expect(coverage.Berlin?.shops).toBe(2);
    expect(coverage.Bayern?.netNewCandidates).toBe(1);
    expect(allBundeslaender().length).toBeGreaterThan(10);
  });
});

describe('Germany shop seeds', () => {
  it('merges NRW foundation with nationwide expansion seeds', () => {
    const seeds = buildGermanyShopSeeds();
    expect(seeds.length).toBeGreaterThan(20);
    expect(seeds.some((entry) => entry.slug === 'bootshaus-club')).toBe(true);
    expect(seeds.some((entry) => entry.city === 'Berlin')).toBe(true);
    expect(seeds.some((entry) => entry.city === 'Hamburg')).toBe(true);
  });
});

describe('shop geography enrichment', () => {
  it('enriches shops with German geography metadata', () => {
    const germanShop = enrichShopWithGeography(
      shop({ slug: 'watergate', city: 'Berlin', region: 'Berlin' }),
      [event({ city: 'Berlin', venueName: 'Watergate' })],
    );
    expect(germanShop.isGermanShop).toBe(true);
    expect(germanShop.bundesland).toBe('Berlin');
    expect(germanShop.geographyConfidence).not.toBe('UNKNOWN');
  });
});

describe('controlled batch selection', () => {
  it('selects quality-ranked candidates with shop and city diversity', () => {
    const candidates = [
      enriched({ identityKey: 'a', shopSlug: 'shop-a', city: 'Berlin', importReadinessScore: 90 }),
      enriched({ identityKey: 'b', shopSlug: 'shop-b', city: 'Hamburg', importReadinessScore: 88 }),
      enriched({ identityKey: 'c', shopSlug: 'shop-c', city: 'München', importReadinessScore: 85 }),
      enriched({ identityKey: 'd', shopSlug: 'shop-a', city: 'Berlin', importReadinessScore: 50 }),
    ];
    const result = selectControlledImportBatch(candidates, { targetSize: 3, minSize: 2, maxSize: 5 });
    expect(result.selected.length).toBe(3);
    expect(result.selected[0]?.importReadinessScore).toBeGreaterThanOrEqual(85);
    expect(new Set(result.selected.map((entry) => entry.shopSlug)).size).toBeGreaterThanOrEqual(2);
  });
});

describe('import quality contract gate', () => {
  it('evaluates candidates through NEW_EVENT_QUALITY_CONTRACT', () => {
    const result = evaluateImportCandidateQualityContract(enriched());
    expect(result.qualityContractBypass).toBe(false);
    expect(result.domainState).toBe('ELECTRONIC_HIGH');
    expect(result.titleReady).toBe(true);
    expect(result.evaluation.qualityState).toBeDefined();
  });
});
