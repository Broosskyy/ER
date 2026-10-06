import { describe, expect, it } from 'vitest';

import type { EnrichedTicketIoEvent } from '../../ticket-evidence/network-discovery/detail-types';
import type { ImportQualityContractResult } from '../../ticket-evidence/network-discovery/import-quality-contract-gate';
import {
  determineImportEligibility,
  passesImportEligibilityFromSnapshot,
} from '../import-eligibility';
import type { RausgegangenLiveVerification } from '../rausgegangen-controlled-import-bridge';

function baseVerification(
  overrides: Partial<RausgegangenLiveVerification> = {},
): RausgegangenLiveVerification {
  return {
    identityKey: 'rausgegangen:test-event',
    sourceUrl: 'https://rausgegangen.de/events/test-event/',
    verifiedAt: '2026-09-17T12:00:00.000Z',
    referenceDateLocal: '2026-09-17',
    liveAccessible: true,
    detailAccess: 'DETAIL_ACCESSIBLE',
    title: 'Techno Night',
    startsAt: '2026-09-20T22:00:00.000Z',
    venueName: 'Club',
    city: 'Köln',
    descriptionQualification: 'FULL_DESCRIPTION',
    lineup: ['DJ Test'],
    lineupQualification: 'FULL_LINEUP',
    genres: [],
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: [],
    mediaAcceptability: 'ACCEPTABLE_EVENT_MEDIA',
    ticketUrl: 'https://example.com/ticket',
    ticketAvailability: 'AVAILABLE',
    ticketAction: 'PURCHASE',
    matchClassification: 'NET_NEW',
    matchReasons: [],
    fromCache: false,
    ...overrides,
  };
}

function baseEnriched(overrides: Partial<EnrichedTicketIoEvent> = {}): EnrichedTicketIoEvent {
  return {
    identityKey: 'rausgegangen:test-event',
    ticketIoEventId: 'test-event',
    shopId: 'rausgegangen:cologne',
    shopSlug: 'cologne',
    listingUrl: 'https://rausgegangen.de/cologne/',
    eventUrl: 'https://rausgegangen.de/events/test-event/',
    canonicalUrl: 'https://rausgegangen.de/events/test-event/',
    title: 'Techno Night',
    startsAt: '2026-09-20T22:00:00.000Z',
    lifecycle: 'UPCOMING',
    venueName: 'Club',
    city: 'Köln',
    descriptionQualification: 'FULL_DESCRIPTION',
    lineupHints: ['DJ Test'],
    lineupQualification: 'FULL_LINEUP',
    genreHints: ['Techno'],
    genreCandidates: [{ label: 'Techno', confidence: 'explicit' }],
    outboundLinks: [],
    verifiedOutbound: [],
    imageUrls: ['https://example.com/flyer.jpg'],
    mediaRoles: ['event_flyer'],
    bestMediaUrl: 'https://example.com/flyer.jpg',
    products: [],
    ticketAvailability: 'AVAILABLE',
    ticketAction: 'PURCHASE',
    detailAccess: 'DETAIL_ACCESSIBLE',
    fetchMethod: 'fetch',
    fetchStatus: 200,
    evidenceTimestamp: '2026-09-17T12:00:00.000Z',
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: [],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    qualification: 'IMPORT_CANDIDATE',
    fieldEvidence: [],
    ...overrides,
  } as EnrichedTicketIoEvent;
}

function baseContract(
  overrides: Partial<ImportQualityContractResult> = {},
): ImportQualityContractResult {
  return {
    identityKey: 'rausgegangen:test-event',
    title: 'Techno Night',
    domainState: 'ELECTRONIC_HIGH',
    identityState: 'NET_NEW',
    qualityState: 'READY',
    titleReady: true,
    timeReady: true,
    venueReady: true,
    genreState: 'VERIFIED',
    lineupState: 'VERIFIED',
    ticketState: 'VERIFIED',
    mediaState: 'VERIFIED',
    descriptionState: 'VERIFIED',
    reviewReasons: [],
    passesQualityContract: true,
    qualityContractBypass: false,
    structuredContentEvaluated: true,
    lineupLeakage: false,
    genreLeakage: false,
    ticketLeakage: false,
    scheduleLeakage: false,
    descriptionQuality: 'EDITORIAL',
    genrePresenceCoverage: true,
    genreEvidenceCompleteness: true,
    explicitGenreClaims: 1,
    canonicalizedExplicitGenreClaims: 1,
    explicitGenreEvidenceParity: 1,
    recoverableExplicitGenreMissing: 0,
    evaluation: {} as ImportQualityContractResult['evaluation'],
    ...overrides,
  };
}

describe('import eligibility', () => {
  const referenceInstant = new Date('2026-09-17T12:00:00.000Z');

  it('blocks qualityReady + AMBIGUOUS relevance', () => {
    const result = determineImportEligibility(
      baseVerification({ relevance: 'AMBIGUOUS' }),
      baseEnriched({ relevance: 'AMBIGUOUS' }),
      baseContract(),
      referenceInstant,
    );
    expect(result.outcome).toBe('BLOCKED_RELEVANCE');
  });

  it('blocks qualityReady + IRRELEVANT relevance', () => {
    const result = determineImportEligibility(
      baseVerification({ relevance: 'IRRELEVANT' }),
      baseEnriched({ relevance: 'IRRELEVANT' }),
      baseContract(),
      referenceInstant,
    );
    expect(result.outcome).toBe('BLOCKED_RELEVANCE');
  });

  it('allows HIGH relevance + full quality contract as ELIGIBLE_NEW', () => {
    const result = determineImportEligibility(
      baseVerification(),
      baseEnriched(),
      baseContract(),
      referenceInstant,
    );
    expect(result.outcome).toBe('ELIGIBLE_NEW');
  });

  it('blocks non-electronic domain even when quality contract passes', () => {
    const result = determineImportEligibility(
      baseVerification(),
      baseEnriched(),
      baseContract({ domainState: 'NON_ELECTRONIC' }),
      referenceInstant,
    );
    expect(result.outcome).toBe('BLOCKED_DOMAIN');
  });

  it('does not invent genre — domain electronic without genre still eligible if contract passes', () => {
    const result = determineImportEligibility(
      baseVerification(),
      baseEnriched(),
      baseContract({ domainState: 'ELECTRONIC_MEDIUM', genreState: 'REVIEW' }),
      referenceInstant,
    );
    expect(result.outcome).toBe('ELIGIBLE_NEW');
  });

  it('maps existing strong match to ELIGIBLE_EXISTING_MATCH', () => {
    const result = determineImportEligibility(
      baseVerification({ matchClassification: 'EXISTING_EXACT' }),
      baseEnriched({ matchClassification: 'EXISTING_EXACT' }),
      baseContract(),
      referenceInstant,
    );
    expect(result.outcome).toBe('ELIGIBLE_EXISTING_MATCH');
  });

  it('passesImportEligibilityFromSnapshot requires relevance and domain', () => {
    expect(
      passesImportEligibilityFromSnapshot('HIGH_RELEVANCE', 'ELECTRONIC_HIGH', true),
    ).toBe(true);
    expect(
      passesImportEligibilityFromSnapshot('AMBIGUOUS', 'ELECTRONIC_HIGH', true),
    ).toBe(false);
    expect(
      passesImportEligibilityFromSnapshot('HIGH_RELEVANCE', 'AMBIGUOUS', true),
    ).toBe(false);
    expect(
      passesImportEligibilityFromSnapshot('IRRELEVANT', 'ELECTRONIC_HIGH', true),
    ).toBe(false);
  });
});
