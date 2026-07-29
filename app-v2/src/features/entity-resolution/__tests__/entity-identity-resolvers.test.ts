import { describe, expect, it } from 'vitest';

import {
  ArtistIdentityResolver,
  buildEntityCandidateKey,
  InMemoryEntityAliasStore,
  OrganizerIdentityResolver,
  VenueIdentityResolver,
} from '@/features/entity-resolution';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

function candidate(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    externalId: 'ext-1',
    rawSourceType: 'api_json',
    title: 'Night Shift',
    organizerName: 'Boiler Room',
    venueName: 'Bootshaus',
    venueAddress: 'Auenweg 173',
    cityName: 'Köln',
    countryCode: 'DE',
    startDate: '2026-08-01',
    artistNames: ['DJ Alias'],
    ...overrides,
  };
}

const catalog: MatchingCatalog = {
  cities: [{ id: 'city-koeln', name: 'Köln' }],
  venues: [
    {
      id: 'venue-bootshaus',
      name: 'Bootshaus',
      address: 'Auenweg 173',
      cityId: 'city-koeln',
      cityName: 'Köln',
    },
  ],
  organizers: [{ id: 'org-boiler-room', name: 'Boiler Room', website: 'https://boilerroom.tv' }],
  artists: [{ id: 'artist-alias', name: 'DJ Alias', aliases: ['Alias'] }],
  genres: [],
  events: [],
};

describe('entity identity resolvers', () => {
  it('matches the same organizer from two sources via external id', () => {
    const store = new InMemoryEntityAliasStore();
    store.saveAlias({
      entityType: 'organizer',
      canonicalId: 'org-boiler-room',
      aliasType: 'external_id',
      aliasValue: 'br-001',
      sourceId: 'source-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const resolver = new OrganizerIdentityResolver(store);
    const outcome = resolver.resolve({
      candidate: candidate({ organizerName: 'Boiler Room Berlin' }),
      catalog,
      sourceId: 'source-a',
      externalOrganizerId: 'br-001',
    });

    expect(outcome.decision).toBe('matched');
    expect(outcome.canonicalId).toBe('org-boiler-room');
  });

  it('matches venue with slightly different name', () => {
    const resolver = new VenueIdentityResolver(new InMemoryEntityAliasStore());
    const outcome = resolver.resolve({
      candidate: candidate({ venueName: 'Bootshaus' }),
      catalog,
      sourceId: 'source-b',
      matchedCityId: 'city-koeln',
    });

    expect(outcome.decision).toBe('matched');
    expect(outcome.canonicalId).toBe('venue-bootshaus');
  });

  it('prefers source defaultVenueId over catalog fuzzy match', () => {
    const ambiguousCatalog: MatchingCatalog = {
      ...catalog,
      venues: [
        {
          id: 'staging-seed-venue-bootshaus',
          name: 'Bootshaus',
          address: 'Auenweg 173',
          cityId: 'city-koeln',
          cityName: 'Köln',
        },
        {
          id: 'venue-bootshaus-koeln',
          name: 'Bootshaus',
          address: 'Auenweg 173',
          cityId: 'city-koeln',
          cityName: 'Köln',
        },
      ],
    };
    const resolver = new VenueIdentityResolver(new InMemoryEntityAliasStore());
    const outcome = resolver.resolve({
      candidate: candidate({
        venueName: 'Bootshaus',
        sourceMetadata: { defaultVenueId: 'venue-bootshaus-koeln' },
      }),
      catalog: ambiguousCatalog,
      sourceId: 'source-bootshaus-koeln',
      matchedCityId: 'city-koeln',
    });

    expect(outcome.decision).toBe('matched');
    expect(outcome.canonicalId).toBe('venue-bootshaus-koeln');
    expect(outcome.reasonCodes).toContain('source_default_venue_id');
  });

  it('matches artist via alias', () => {
    const resolver = new ArtistIdentityResolver(new InMemoryEntityAliasStore());
    const outcome = resolver.resolveOne(
      {
        candidate: candidate(),
        catalog,
        sourceId: 'source-c',
      },
      'Alias',
    );

    expect(outcome.decision).toBe('matched');
    expect(outcome.canonicalId).toBe('artist-alias');
  });

  it('routes uncertain matches to review', () => {
    const ambiguousCatalog: MatchingCatalog = {
      ...catalog,
      organizers: [
        { id: 'org-1', name: 'Resident Advisor' },
        { id: 'org-2', name: 'Resident Advisor' },
      ],
    };
    const resolver = new OrganizerIdentityResolver(new InMemoryEntityAliasStore());
    const outcome = resolver.resolve({
      candidate: candidate({ organizerName: 'Resident Advisor' }),
      catalog: ambiguousCatalog,
      sourceId: 'source-d',
    });

    expect(outcome.decision).toBe('review_required');
    expect(outcome.reasonCodes).toContain('ambiguous_name');
  });

  it('respects keep separate decisions', () => {
    const store = new InMemoryEntityAliasStore();
    const candidateKey = buildEntityCandidateKey({
      sourceId: 'source-e',
      name: 'Boiler Room',
    });
    store.saveDecision({
      entityType: 'organizer',
      candidateKey,
      decision: 'keep_separate',
      decidedBy: 'admin',
      decidedAt: '2026-01-01T00:00:00.000Z',
      reason: 'distinct regional chapter',
    });

    const resolver = new OrganizerIdentityResolver(store);
    const outcome = resolver.resolve({
      candidate: candidate({ organizerName: 'Boiler Room' }),
      catalog,
      sourceId: 'source-e',
    });

    expect(outcome.decision).toBe('keep_separate');
    expect(outcome.reasonCodes).toContain('manual_keep_separate');
  });

  it('preserves manual override canonical id', () => {
    const store = new InMemoryEntityAliasStore();
    const candidateKey = buildEntityCandidateKey({
      sourceId: 'source-f',
      name: 'Boiler Room',
    });
    store.saveDecision({
      entityType: 'organizer',
      candidateKey,
      decision: 'manual_override',
      canonicalId: 'org-custom',
      decidedBy: 'admin',
      decidedAt: '2026-01-01T00:00:00.000Z',
      reason: 'verified profile',
    });

    const resolver = new OrganizerIdentityResolver(store);
    const outcome = resolver.resolve({
      candidate: candidate({ organizerName: 'Boiler Room' }),
      catalog,
      sourceId: 'source-f',
    });

    expect(outcome.decision).toBe('manual_override');
    expect(outcome.canonicalId).toBe('org-custom');
  });
});
