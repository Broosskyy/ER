import { describe, expect, it } from 'vitest';

import { extractHeadlinerFromTitle, getArtistIdentityKey } from '../artist-identity';
import { buildArtistGenreProfile, mergeArtistEvidence } from '../artist-genre-consensus';
import { hasIncompatibleGenreFamilies } from '../../genre-taxonomy';
import { isSearchableGenreConfidence, lineupConsensusConfidence } from '../discovery-confidence-policy';
import { deriveEventGenresFromLineupConsensus } from '../lineup-genre-consensus';
import { ArtistProfileStore } from '../artist-profile-store';
import type { ArtistGenreEvidence } from '../types';

function evidence(input: Partial<ArtistGenreEvidence> & { genreKey: string; displayName: string }): ArtistGenreEvidence {
  return {
    artistIdentity: input.artistIdentity ?? 'test-artist',
    normalizedName: input.normalizedName ?? 'Test Artist',
    genreKey: input.genreKey,
    displayName: input.displayName,
    sourceType: input.sourceType ?? 'HISTORICAL_EVENT',
    sourceReference: input.sourceReference ?? 'event:1',
    evidenceStrength: input.evidenceStrength ?? 'STRONG',
    confidence: input.confidence ?? 'HIGH',
    observedAt: input.observedAt ?? new Date().toISOString(),
    classificationReason: input.classificationReason ?? 'test',
  };
}

describe('artist identity', () => {
  it('normalizes case and spacing for identity keys', () => {
    expect(getArtistIdentityKey('CHRIS STUSSY')).toBe(getArtistIdentityKey('Chris Stussy'));
  });

  it('extracts headliner from pres-by title pattern', () => {
    expect(extractHeadlinerFromTitle('DEBORAH DE LUCA pres by Bootshaus')).toBe('DEBORAH DE LUCA');
  });
});

describe('artist genre consensus', () => {
  it('publishes genres from multi-source evidence', () => {
    const profile = buildArtistGenreProfile({
      artistIdentity: 'sara-landry',
      normalizedName: 'SARA LANDRY',
      observedAt: new Date().toISOString(),
      evidence: [
        evidence({
          genreKey: 'hardtechno',
          displayName: 'Hard Techno',
          sourceType: 'MUSICBRAINZ',
        }),
        evidence({
          genreKey: 'hardtechno',
          displayName: 'Hard Techno',
          sourceType: 'DISCOGS',
        }),
      ],
    });
    expect(profile.canonicalGenres.map((genre) => genre.displayName)).toContain('Hard Techno');
    expect(profile.confidence).not.toBe('CONFLICT');
  });

  it('publishes musicbrainz multi-tag techno profiles without false conflict', () => {
    const profile = buildArtistGenreProfile({
      artistIdentity: 'deborah de luca',
      normalizedName: 'DEBORAH DE LUCA',
      observedAt: new Date().toISOString(),
      evidence: [
        evidence({
          genreKey: 'electronic',
          displayName: 'Electronic',
          sourceType: 'MUSICBRAINZ',
          sourceReference: 'musicbrainz:deborah',
        }),
        evidence({
          genreKey: 'dance',
          displayName: 'Dance',
          sourceType: 'MUSICBRAINZ',
          sourceReference: 'musicbrainz:deborah',
        }),
        evidence({
          genreKey: 'peak-time-techno',
          displayName: 'Peak Time Techno',
          sourceType: 'MUSICBRAINZ',
          sourceReference: 'musicbrainz:deborah',
        }),
        evidence({
          genreKey: 'techno',
          displayName: 'Techno',
          sourceType: 'MUSICBRAINZ',
          sourceReference: 'musicbrainz:deborah',
        }),
      ],
    });
    expect(profile.confidence).not.toBe('CONFLICT');
    expect(profile.canonicalGenres.length).toBeGreaterThan(0);
    expect(
      profile.canonicalGenres.some((genre) =>
        ['Techno', 'Peak Time Techno'].includes(genre.displayName),
      ),
    ).toBe(true);
  });

  it('merges evidence without duplication', () => {
    const merged = mergeArtistEvidence(
      [evidence({ genreKey: 'techno', displayName: 'Techno', sourceType: 'MUSICBRAINZ' })],
      [evidence({ genreKey: 'techno', displayName: 'Techno', sourceType: 'DISCOGS' })],
    );
    expect(merged).toHaveLength(2);
  });
});

describe('lineup consensus', () => {
  it('derives event genres from classified lineup majority', () => {
    const store = new ArtistProfileStore();
    const observedAt = new Date().toISOString();
    for (const artist of ['ACT A', 'ACT B', 'ACT C', 'ACT D', 'ACT E', 'ACT F']) {
      store.upsertEvidence(
        artist,
        [
          evidence({
            artistIdentity: getArtistIdentityKey(artist),
            normalizedName: artist,
            genreKey: 'techno',
            displayName: 'Techno',
            observedAt,
          }),
        ],
      );
    }
    const result = deriveEventGenresFromLineupConsensus({
      eventId: 'event-1',
      title: 'Festival Night',
      lineup: ['ACT A', 'ACT B', 'ACT C', 'ACT D', 'ACT E', 'ACT F'],
      store,
    });
    expect(result.genres.map((genre) => genre.displayName)).toContain('Techno');
    expect(result.classifiedArtists).toBe(6);
  });

  it('uses primary billing act when title has no headliner', () => {
    const store = new ArtistProfileStore();
    store.upsertEvidence(
      'MOGUAI',
      [
        evidence({
          artistIdentity: getArtistIdentityKey('MOGUAI'),
          normalizedName: 'MOGUAI',
          genreKey: 'techno',
          displayName: 'Techno',
          sourceType: 'STRUCTURED_SOURCE',
          confidence: 'MEDIUM',
        }),
      ],
    );
    const result = deriveEventGenresFromLineupConsensus({
      eventId: 'event-3',
      title: 'BC173 Airport Session pres. by Bootshaus',
      lineup: ['MOGUAI', 'SUPPORT ACT'],
      store,
    });
    expect(result.genres.map((genre) => genre.displayName)).toContain('Techno');
  });

  it('uses headliner profile for single-act events', () => {
    const store = new ArtistProfileStore();
    store.upsertEvidence(
      'SARA LANDRY',
      [
        evidence({
          artistIdentity: getArtistIdentityKey('SARA LANDRY'),
          normalizedName: 'SARA LANDRY',
          genreKey: 'hardtechno',
          displayName: 'Hard Techno',
        }),
      ],
    );
    const result = deriveEventGenresFromLineupConsensus({
      eventId: 'event-2',
      title: 'SARA LANDRY pres. by BOOTSHAUS',
      lineup: ['SARA LANDRY'],
      store,
    });
    expect(result.genres.map((genre) => genre.displayName)).toContain('Hard Techno');
  });
});

describe('taxonomy compatibility', () => {
  it('treats hard techno and techno as compatible', () => {
    expect(hasIncompatibleGenreFamilies(['techno', 'hardtechno'])).toBe(false);
  });

  it('flags house vs techno as incompatible', () => {
    expect(hasIncompatibleGenreFamilies(['house', 'techno'])).toBe(true);
  });
});

describe('discovery confidence policy', () => {
  it('allows explicit high and medium confidence in search', () => {
    expect(isSearchableGenreConfidence('HIGH')).toBe(true);
    expect(isSearchableGenreConfidence('MEDIUM')).toBe(true);
    expect(isSearchableGenreConfidence('LOW')).toBe(false);
  });

  it('requires sufficient lineup coverage for consensus confidence', () => {
    expect(
      lineupConsensusConfidence({
        classifiedArtists: 5,
        totalArtists: 6,
        headlinerMatch: false,
        maxVotes: 5,
        voteThreshold: 2,
      }),
    ).toBe('HIGH');
  });
});
