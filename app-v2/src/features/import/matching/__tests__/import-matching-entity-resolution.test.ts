import { describe, expect, it } from 'vitest';

import {
  ArtistIdentityResolver,
  buildEntityCandidateKey,
  InMemoryEntityAliasStore,
  OrganizerIdentityResolver,
  VenueIdentityResolver,
} from '@/features/entity-resolution';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportMatchingService } from '@/features/import/matching/import-matching-service';
import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

const baseCandidate: NormalizedEventCandidate = {
  externalId: 'new-1',
  sourceId: 'source-a',
  title: 'Techno Night',
  startDate: '2026-08-15T20:00:00.000Z',
  cityName: 'Köln',
  venueName: 'Bootshaus',
  venueAddress: 'Auenweg 173, 51063 Köln',
  latitude: 50.965,
  longitude: 7.005,
  artistNames: ['Ben Klock'],
  genreNames: ['Tech House'],
  organizerName: 'Boiler Room',
  rawSourceType: 'json_ld',
};

describe('ImportMatchingService entity resolution integration', () => {
  it('uses identity resolvers when configured via factory', () => {
    const { matchingService } = createImportMatchingService();
    const { result, logs } = matchingService.match(baseCandidate, createTestMatchingCatalog());

    expect(result.matchedCityId).toBe('koeln');
    expect(result.matchedVenueId).toBe('venue-1');
    expect(result.matchedArtistIds).toContain('artist-1');
    expect(logs.some((log) => log.code === 'VENUE_MATCHED')).toBe(true);
    expect(logs.some((log) => log.code === 'ARTIST_MATCHED')).toBe(true);
  });

  it('matches organizer via external source id alias', () => {
    const aliasStore = new InMemoryEntityAliasStore();
    aliasStore.saveAlias({
      entityType: 'organizer',
      canonicalId: 'org-boiler-room',
      aliasType: 'external_id',
      aliasValue: 'br-001',
      sourceId: 'source-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const matchingService = new ImportMatchingService({
      venueResolver: new VenueIdentityResolver(aliasStore),
      organizerResolver: new OrganizerIdentityResolver(aliasStore),
      artistResolver: new ArtistIdentityResolver(aliasStore),
    });

    const { result, logs } = matchingService.match(
      {
        ...baseCandidate,
        organizerName: 'Different Label',
        sourceMetadata: { externalOrganizerId: 'br-001' },
      },
      createTestMatchingCatalog(),
    );

    expect(result.matchedOrganizerId).toBe('org-boiler-room');
    expect(logs.some((log) => log.code === 'ORGANIZER_MATCHED')).toBe(true);
  });

  it('respects manual keep-separate decisions during import matching', () => {
    const aliasStore = new InMemoryEntityAliasStore();
    aliasStore.saveDecision({
      entityType: 'venue',
      candidateKey: buildEntityCandidateKey({
        sourceId: 'source-a',
        name: 'Bootshaus',
        address: baseCandidate.venueAddress,
        city: baseCandidate.cityName,
      }),
      decision: 'keep_separate',
      decidedBy: 'admin',
      decidedAt: '2026-01-01T00:00:00.000Z',
      reason: 'duplicate venue profile',
    });

    const matchingService = new ImportMatchingService({
      venueResolver: new VenueIdentityResolver(aliasStore),
      organizerResolver: new OrganizerIdentityResolver(aliasStore),
      artistResolver: new ArtistIdentityResolver(aliasStore),
    });

    const { result, logs } = matchingService.match(baseCandidate, createTestMatchingCatalog());

    expect(result.matchedVenueId).toBeUndefined();
    expect(logs.some((log) => log.code === 'VENUE_KEEP_SEPARATE')).toBe(true);
  });

  it('keeps legacy matching path when no resolvers are configured', () => {
    const service = new ImportMatchingService();
    const { result } = service.match(baseCandidate, createTestMatchingCatalog());

    expect(result.matchedVenueId).toBe('venue-1');
    expect(result.matchedArtistIds).toContain('artist-1');
  });
});
