import { describe, expect, it } from 'vitest';

import { evaluateImportCandidateQualityContract } from '../import-quality-contract-gate';
import { buildGenreCandidates } from '../field-evidence';
import type { EnrichedTicketIoEvent } from '../detail-types';
import { determineImportEligibility } from '../../../rausgegangen-discovery/import-eligibility';
import type { RausgegangenLiveVerification } from '../../../rausgegangen-discovery/rausgegangen-controlled-import-bridge';

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

    const verification: RausgegangenLiveVerification = {
      identityKey: event.identityKey,
      sourceUrl: event.canonicalUrl,
      verifiedAt: '2026-10-07T00:00:00.000Z',
      referenceDateLocal: '2026-10-07',
      liveAccessible: true,
      detailAccess: event.detailAccess,
      title: event.title,
      startsAt: event.startsAt,
      venueName: event.venueName,
      city: event.city,
      descriptionQualification: event.descriptionQualification,
      lineup: event.lineupHints,
      lineupQualification: event.lineupQualification,
      genres: event.genreCandidates,
      relevance: event.relevance,
      relevanceReasons: event.relevanceReasons,
      bestMediaUrl: event.bestMediaUrl,
      mediaAcceptability: 'ACCEPTABLE_EVENT_MEDIA',
      ticketUrl: event.eventUrl,
      ticketAvailability: event.ticketAvailability,
      ticketAction: event.ticketAction,
      matchClassification: event.matchClassification,
      matchReasons: [],
      fromCache: false,
    };
    const eligibility = determineImportEligibility(
      verification,
      event,
      result,
      new Date('2026-10-07T00:00:00.000Z'),
    );

    expect(result.genrePresenceCoverage).toBe(false);
    expect(result.genreState).not.toBe('VERIFIED');
    expect(eligibility.outcome).toBe('BLOCKED_GENRE');
    expect(eligibility.reasons).toContain('genre_presence_missing');
  });
});
