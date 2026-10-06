import { describe, expect, it } from 'vitest';

import type { EnrichedTicketIoEvent } from '../../ticket-evidence/network-discovery/detail-types';
import type { ImportQualityContractResult } from '../../ticket-evidence/network-discovery/import-quality-contract-gate';
import {
  selectM94EScaleCohort,
  type M94EQualityPoolEntry,
} from '../m9-4e-cohort-selection';

function event(index: number, options?: {
  relevance?: EnrichedTicketIoEvent['relevance'];
  lifecycle?: EnrichedTicketIoEvent['lifecycle'];
  city?: string;
}): EnrichedTicketIoEvent {
  const city = options?.city ?? ['Köln', 'Berlin', 'Hamburg', 'Leipzig'][index % 4]!;
  return {
    identityKey: `rausgegangen:event-${String(index).padStart(3, '0')}`,
    ticketIoEventId: `event-${String(index).padStart(3, '0')}`,
    shopId: `rausgegangen:${city.toLowerCase()}`,
    shopSlug: city.toLowerCase(),
    listingUrl: `https://rausgegangen.de/${city.toLowerCase()}/`,
    eventUrl: `https://rausgegangen.de/events/event-${index}/`,
    canonicalUrl: `https://rausgegangen.de/events/event-${index}/`,
    title: `Event ${index}`,
    startsAt: new Date(Date.UTC(2027, index % 12, (index % 25) + 1)).toISOString(),
    lifecycle: options?.lifecycle ?? 'UPCOMING',
    city,
    descriptionQualification: 'FULL_DESCRIPTION',
    lineupHints: [],
    lineupQualification: 'NO_LINEUP',
    genreHints: ['Techno'],
    genreCandidates: [{ label: index % 3 === 0 ? 'House' : 'Techno', confidence: 'explicit' }],
    outboundLinks: [],
    verifiedOutbound: [],
    imageUrls: ['https://example.com/event.jpg'],
    mediaRoles: ['event_flyer'],
    bestMediaUrl: 'https://example.com/event.jpg',
    products: [],
    ticketAvailability: 'UNKNOWN',
    ticketAction: 'NONE',
    detailAccess: 'DETAIL_ACCESSIBLE',
    fetchMethod: 'fetch',
    evidenceTimestamp: '2026-10-06T00:00:00.000Z',
    relevance: options?.relevance ?? 'HIGH_RELEVANCE',
    relevanceReasons: [],
    matchClassification: index % 5 === 0 ? 'EXISTING_STRONG_MATCH' : 'NET_NEW',
    matchReasons: [],
    qualification: 'IMPORT_CANDIDATE',
    importReadinessScore: 1000 - index,
    fieldEvidence: [],
  };
}

function contract(overrides?: Partial<ImportQualityContractResult>): ImportQualityContractResult {
  return {
    identityKey: 'candidate',
    title: 'candidate',
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

function pool(size = 140): M94EQualityPoolEntry[] {
  return Array.from({ length: size }, (_, index) => ({
    event: event(index),
    contract: contract(),
  }));
}

describe('M9.4E scale cohort selection', () => {
  it('selects a deterministic 100-event cohort with 25% location-only coverage', () => {
    const entries = pool();
    const locationOnly = new Set(entries.slice(0, 40).map((entry) => entry.event.ticketIoEventId));
    const excluded = new Set(entries.slice(40, 50).map((entry) => entry.event.identityKey));

    const first = selectM94EScaleCohort({
      poolEntries: entries,
      locationOnlySlugs: locationOnly,
      excludedIdentityKeys: excluded,
      targetSize: 100,
    });
    const second = selectM94EScaleCohort({
      poolEntries: entries,
      locationOnlySlugs: locationOnly,
      excludedIdentityKeys: excluded,
      targetSize: 100,
    });

    expect(first.entries).toEqual(second.entries);
    expect(first.entries).toHaveLength(100);
    expect(first.entries.filter((entry) => entry.locationOnly)).toHaveLength(25);
    expect(first.entries.some((entry) => excluded.has(entry.identityKey))).toBe(false);
    expect(new Set(first.entries.map((entry) => entry.identityKey)).size).toBe(100);
  });

  it('excludes ambiguous, irrelevant, ended and non-electronic snapshots', () => {
    const entries = pool(120);
    entries[0] = { event: event(0, { relevance: 'AMBIGUOUS' }), contract: contract() };
    entries[1] = { event: event(1, { relevance: 'IRRELEVANT' }), contract: contract() };
    entries[2] = { event: event(2, { lifecycle: 'ENDED' }), contract: contract() };
    entries[3] = { event: event(3), contract: contract({ domainState: 'AMBIGUOUS' }) };

    const selection = selectM94EScaleCohort({
      poolEntries: entries,
      locationOnlySlugs: new Set(),
      excludedIdentityKeys: new Set(),
      targetSize: 100,
    });

    const selected = new Set(selection.entries.map((entry) => entry.identityKey));
    expect(selected.has(entries[0]!.event.identityKey)).toBe(false);
    expect(selected.has(entries[1]!.event.identityKey)).toBe(false);
    expect(selected.has(entries[2]!.event.identityKey)).toBe(false);
    expect(selected.has(entries[3]!.event.identityKey)).toBe(false);
  });

  it('fails instead of silently shrinking a requested cohort', () => {
    expect(() =>
      selectM94EScaleCohort({
        poolEntries: pool(30),
        locationOnlySlugs: new Set(),
        excludedIdentityKeys: new Set(),
        targetSize: 100,
      }),
    ).toThrow('m94e_insufficient_snapshot_pool');
  });
});
