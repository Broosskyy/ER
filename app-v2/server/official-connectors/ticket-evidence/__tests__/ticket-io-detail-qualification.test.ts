import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { enrichCandidateWithDetail } from '../network-discovery/detail-enrichment';
import type { DetailFetchResult } from '../network-discovery/detail-fetch';
import { classifyDetailRelevance } from '../network-discovery/detail-relevance';
import { dedupeDescription, qualifyDescription, qualifyLineup, verifyOutboundSources } from '../network-discovery/field-evidence';
import { computeInventoryDelta } from '../network-discovery/inventory-delta';
import { buildFirstBatchPacket, selectFirstBatchCandidates } from '../network-discovery/first-batch';
import { enumerateTicketProducts, mapOfferCategoryForTest } from '../network-discovery/product-qualification';
import {
  calculateImportReadinessScore,
  protectGoldenDuplicates,
  qualifyEnrichedEvent,
} from '../network-discovery/qualification';
import type { EnrichedTicketIoEvent } from '../network-discovery/detail-types';
import type { TicketIoEventDiscoveryCandidate } from '../network-discovery/types';
import { parseTicketIoDetailDom } from '../parse-ticket-io-detail-dom';

const FIXTURES = join(__dirname, 'fixtures');

function candidate(overrides: Partial<TicketIoEventDiscoveryCandidate>): TicketIoEventDiscoveryCandidate {
  return {
    identityKey: 'ticket_io:bootshaus-club:abc123',
    ticketIoEventId: 'abc123',
    shopId: 'bootshaus-club',
    shopSlug: 'bootshaus-club',
    title: 'Techno Night',
    startsAt: '2026-12-01T20:00:00+01:00',
    lifecycle: 'UPCOMING',
    ticketUrl: 'https://bootshaus-club.ticket.io/abc123/',
    canonicalUrl: 'https://bootshaus-club.ticket.io/abc123/',
    lineupHints: [],
    genreHints: [],
    outboundLinks: [],
    imageUrls: [],
    visibleProducts: [],
    relevance: 'AMBIGUOUS',
    relevanceReasons: [],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    mediaRoles: [],
    discoveredFromSurfaces: ['seed'],
    ...overrides,
  };
}

function enriched(overrides: Partial<EnrichedTicketIoEvent>): EnrichedTicketIoEvent {
  return {
    identityKey: 'ticket_io:bootshaus-club:abc123',
    ticketIoEventId: 'abc123',
    shopId: 'bootshaus-club',
    shopSlug: 'bootshaus-club',
    listingUrl: 'https://bootshaus-club.ticket.io/',
    eventUrl: 'https://bootshaus-club.ticket.io/abc123/',
    canonicalUrl: 'https://bootshaus-club.ticket.io/abc123/',
    title: 'Techno Night',
    startsAt: '2026-12-01T20:00:00+01:00',
    lifecycle: 'UPCOMING',
    lineupHints: [],
    lineupQualification: 'NO_LINEUP',
    genreHints: ['Techno'],
    genreCandidates: [{ label: 'Techno', confidence: 'explicit' }],
    outboundLinks: [],
    verifiedOutbound: [],
    imageUrls: [],
    mediaRoles: [],
    products: [],
    ticketAvailability: 'AVAILABLE',
    ticketAction: 'PURCHASE',
    detailAccess: 'DETAIL_ACCESSIBLE',
    fetchMethod: 'fetch',
    evidenceTimestamp: '2026-09-03T12:00:00.000Z',
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: ['high:techno'],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    qualification: 'IMPORT_CANDIDATE',
    descriptionQualification: 'PARTIAL_DESCRIPTION',
    fieldEvidence: [],
    ...overrides,
  };
}

describe('ticket.io detail qualification', () => {
  it('computes inventory delta against previous discovery snapshot', () => {
    const previous = [candidate({ identityKey: 'a', ticketIoEventId: 'a' })];
    const current = [
      candidate({ identityKey: 'a', ticketIoEventId: 'a', title: 'Changed title' }),
      candidate({ identityKey: 'b', ticketIoEventId: 'b' }),
    ];
    const delta = computeInventoryDelta(previous, current);
    expect(delta.previousCandidateCount).toBe(1);
    expect(delta.currentCandidateCount).toBe(2);
    expect(delta.newSincePrevious).toEqual(['b']);
    expect(delta.changedSincePrevious).toEqual(['a']);
  });

  it('classifies detail relevance with ambiguity reason', () => {
    const result = classifyDetailRelevance({
      title: 'Unknown Gathering',
      detailAccess: 'PARTIAL_DETAIL',
    });
    expect(result.relevance).toBe('AMBIGUOUS');
    expect(result.ambiguityReason).toBe('insufficient_detail_evidence');
  });

  it('classifies negative relevance from detail evidence', () => {
    const result = classifyDetailRelevance({
      title: 'Comedy Night',
      description: 'Stand-up comedy show',
    });
    expect(result.relevance).toBe('IRRELEVANT');
  });

  it('enumerates admission products including Doorsale and Blind Ticket', () => {
    const blindHtml = readFileSync(join(FIXTURES, 'ticket-io-nye-blind-ticket.html'), 'utf8');
    const dom = parseTicketIoDetailDom(blindHtml, {
      sourceUrl: 'https://bootshaus-club.ticket.io/S0cbXDda/',
    });
    expect(dom?.offers.length).toBeGreaterThan(0);
    const products = enumerateTicketProducts(dom!.offers, 'https://bootshaus-club.ticket.io/S0cbXDda/');
    expect(products.products.some((product) => product.category === 'ADMISSION')).toBe(true);
    expect(products.currentAdmissionPriceMinor).not.toBeNull();
  });

  it('rejects add-on products as admission', () => {
    expect(mapOfferCategoryForTest('locker', 'Locker')).toBe('LOCKER');
    expect(mapOfferCategoryForTest('other_addon', 'Parking Ticket')).toBe('PARKING');
  });

  it('dedupes repeated description blocks', () => {
    const clean = dedupeDescription('Line one.\n\nLine one.\n\nLine two.');
    expect(clean).toBe('Line one.\n\nLine two.');
    expect(qualifyDescription(clean)).toBe('PARTIAL_DESCRIPTION');
  });

  it('qualifies lineup without branding noise', () => {
    expect(qualifyLineup(['Chris Stussy', 'EARLY BIRD', 'Amelie Lens', 'SOLD OUT', 'VTSS'])).toBe('PARTIAL_LINEUP');
  });

  it('verifies outbound sources conservatively', () => {
    const verified = verifyOutboundSources({
      title: 'Chris Stussy',
      startsAt: '2026-11-14T23:00:00+01:00',
      venueName: 'Bootshaus',
      eventUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
      outboundLinks: ['https://bootshaus.tv/events/chris-stussy/'],
    });
    expect(verified[0]?.verified).toBe(true);
  });

  it('protects Chris Stussy/STASSY golden duplicate mapping', () => {
    const protectedEvent = protectGoldenDuplicates(
      enriched({
        matchedEventId: '2c00fbb7-baa9-47eb-aaa5-52cda45c79a1',
        matchClassification: 'EXISTING_EXACT',
        title: 'CHRIS STASSY',
      }),
    );
    expect(protectedEvent.matchedEventId).toBe('8a8eb9b7-593e-45de-926d-2514735b86cc');
    expect(protectedEvent.qualification).toBe('EXISTING');
  });

  it('qualifies import candidates and readiness score', () => {
    const event = enriched({
      relevance: 'HIGH_RELEVANCE',
      matchClassification: 'NET_NEW',
      venueName: 'Bootshaus',
      currentAdmissionPriceMinor: 4500,
      descriptionQualification: 'FULL_DESCRIPTION',
      lineupQualification: 'PARTIAL_LINEUP',
      bestMediaUrl: 'https://cdn.ticket.io/example.jpg',
    });
    expect(qualifyEnrichedEvent(event)).toBe('IMPORT_CANDIDATE');
    expect(calculateImportReadinessScore(event)).toBeGreaterThan(50);
  });

  it('enriches candidate from accessible detail html', () => {
    const blindHtml = readFileSync(join(FIXTURES, 'ticket-io-nye-blind-ticket.html'), 'utf8');
    const fetchResult: DetailFetchResult = {
      html: blindHtml,
      finalUrl: 'https://bootshaus-club.ticket.io/S0cbXDda/',
      fetchMethod: 'fetch',
      detailAccess: 'DETAIL_ACCESSIBLE',
      blocked: false,
    };
    const result = enrichCandidateWithDetail(
      candidate({
        title: 'NYE 2026',
        ticketUrl: 'https://bootshaus-club.ticket.io/S0cbXDda/',
        ticketIoEventId: 'S0cbXDda',
        identityKey: 'ticket_io:bootshaus-club:s0cbxdda',
      }),
      fetchResult,
      [],
      'https://bootshaus-club.ticket.io/',
    );
    expect(result.detailAccess).toBe('DETAIL_ACCESSIBLE');
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.fieldEvidence.length).toBeGreaterThan(0);
  });

  it('selects a small diverse first batch from import candidates', () => {
    const events = [
      enriched({ identityKey: 'a', shopSlug: 'bootshaus-club', importReadinessScore: 90, city: 'Köln' }),
      enriched({ identityKey: 'b', shopSlug: 'gewoelbe', importReadinessScore: 80, city: 'Köln' }),
      enriched({ identityKey: 'c', shopSlug: 'glow', importReadinessScore: 70, city: 'Essen' }),
    ];
    const batch = selectFirstBatchCandidates(events, 3);
    expect(batch).toHaveLength(3);
    expect(buildFirstBatchPacket(batch[0]!).title).toBeTruthy();
  });
});
