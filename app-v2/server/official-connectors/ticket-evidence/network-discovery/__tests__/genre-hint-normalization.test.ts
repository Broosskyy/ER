import { describe, expect, it } from 'vitest';

import { evaluateImportCandidateQualityContract } from '../import-quality-contract-gate';
import { buildGenreCandidates } from '../field-evidence';
import type { EnrichedTicketIoEvent } from '../detail-types';

describe('source genre hint normalization', () => {
  it('keeps generic city/category source tags weak instead of explicit', () => {
    const candidates = buildGenreCandidates(
      ['leipzig', 'konzerte & musik'],
      'COFFEE PARTY RAVE x COZY.RUNCLUB',
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        { label: 'leipzig', confidence: 'weak_inferred' },
        { label: 'konzerte & musik', confidence: 'weak_inferred' },
      ]),
    );
    expect(candidates.some((candidate) => candidate.confidence === 'explicit')).toBe(false);
  });

  it('keeps known canonical genres explicit while generic tags remain weak', () => {
    const candidates = buildGenreCandidates(['techno', 'Berlin'], 'Warehouse Night');

    expect(candidates).toContainEqual({ label: 'Techno', confidence: 'explicit' });
    expect(candidates).toContainEqual({ label: 'Berlin', confidence: 'weak_inferred' });
  });

  it('does not let a rave title plus generic source tags satisfy the genre publication gate', () => {
    const genreCandidates = buildGenreCandidates(
      ['leipzig', 'konzerte & musik'],
      'COFFEE PARTY RAVE x COZY.RUNCLUB',
    );

    const event: EnrichedTicketIoEvent = {
      identityKey: 'rausgegangen:genre-gate-regression',
      ticketIoEventId: 'genre-gate-regression',
      shopId: 'rausgegangen:leipzig',
      shopSlug: 'leipzig',
      listingUrl: 'https://rausgegangen.de/leipzig/',
      eventUrl: 'https://rausgegangen.de/events/genre-gate-regression/',
      canonicalUrl: 'https://rausgegangen.de/events/genre-gate-regression/',
      title: 'COFFEE PARTY RAVE x COZY.RUNCLUB',
      startsAt: '2027-01-10T12:00:00+01:00',
      lifecycle: 'UPCOMING',
      venueName: 'Test Venue',
      city: 'Leipzig',
      descriptionQualification: 'NO_DESCRIPTION',
      lineupHints: [],
      lineupQualification: 'NO_LINEUP',
      genreHints: ['leipzig', 'konzerte & musik'],
      genreCandidates,
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
      evidenceTimestamp: '2026-10-07T00:00:00.000Z',
      relevance: 'HIGH_RELEVANCE',
      relevanceReasons: ['strong_positive:rave'],
      matchClassification: 'NET_NEW',
      matchReasons: [],
      qualification: 'IMPORT_CANDIDATE',
      fieldEvidence: [],
    };

    const result = evaluateImportCandidateQualityContract(event);

    expect(result.genrePresenceCoverage).toBe(false);
    expect(result.genreState).not.toBe('VERIFIED');
    expect(result.passesQualityContract).toBe(false);
  });
});
