import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../../../ingestion/adapters/official-evidence-adapter';
import { validateEventCandidate } from '../../../ingestion/validation/validate-event-candidate';
import { buildOfficialEvidenceFromEnriched } from '../network-discovery/controlled-import-bridge';
import { TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID } from '../network-discovery/constants';
import type { EnrichedTicketIoEvent } from '../network-discovery/detail-types';
import type { DetailFetchResult } from '../network-discovery/detail-fetch';

function sampleEnriched(overrides: Partial<EnrichedTicketIoEvent> = {}): EnrichedTicketIoEvent {
  return {
    identityKey: 'ticket_io:gewoelbe:ylgm2drq',
    ticketIoEventId: 'ylGM2drQ',
    shopId: 'gewoelbe',
    shopSlug: 'gewoelbe',
    listingUrl: 'https://gewoelbe.ticket.io/',
    eventUrl: 'https://gewoelbe.ticket.io/ylGM2drQ/',
    canonicalUrl: 'https://gewoelbe.ticket.io/ylGM2drQ/',
    title: 'Jack This w/ aphasit, Lingy & Polschi, Mike Starr',
    startsAt: '2026-09-11T23:00:00+02:00',
    lifecycle: 'UPCOMING',
    venueName: 'Gewölbe',
    city: 'Köln',
    description: 'House night in Cologne.',
    descriptionQualification: 'PARTIAL_DESCRIPTION',
    lineupHints: ['aphasit', 'Lingy', 'Polschi', 'Mike Starr'],
    lineupQualification: 'PARTIAL_LINEUP',
    genreHints: ['House'],
    genreCandidates: [{ label: 'House', confidence: 'explicit' }],
    outboundLinks: [],
    verifiedOutbound: [],
    imageUrls: ['https://cdn.ticket.io/companies/gewoelbe/events/ylGM2drQ/img/holder-1080.jpg'],
    mediaRoles: ['event_hero'],
    products: [],
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: ['high:explicit_genre'],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    detailAccess: 'DETAIL_ACCESSIBLE',
    qualification: 'IMPORT_CANDIDATE',
    ...overrides,
  };
}

const sampleFetch: DetailFetchResult = {
  html: '<html><body>ticket event</body></html>',
  finalUrl: 'https://gewoelbe.ticket.io/ylGM2drQ/',
  fetchMethod: 'fetch',
  detailAccess: 'DETAIL_ACCESSIBLE',
  blocked: false,
  contentFingerprint: 'abc123fingerprint',
};

describe('ticket.io controlled import validation', () => {
  it('allows ticket.io event URL as official source for network-discovery connector', () => {
    const evidence = buildOfficialEvidenceFromEnriched(sampleEnriched(), sampleFetch, new Date().toISOString());
    expect(evidence.connectorId).toBe(TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID);
    const candidate = officialEvidenceToEventCandidate(evidence);
    const validation = validateEventCandidate(candidate);
    expect(validation.decision).toBe('persist_ready');
    expect(validation.reasons).not.toContain('ticket_url_used_as_official_source');
  });

  it('still rejects ticket.io URL for non-network-discovery connectors', () => {
    const evidence = buildOfficialEvidenceFromEnriched(sampleEnriched(), sampleFetch, new Date().toISOString());
    evidence.connectorId = 'bootshaus-official';
    const candidate = officialEvidenceToEventCandidate(evidence);
    const validation = validateEventCandidate(candidate);
    expect(validation.decision).toBe('rejected');
    expect(validation.reasons).toContain('ticket_url_used_as_official_source');
  });
});
