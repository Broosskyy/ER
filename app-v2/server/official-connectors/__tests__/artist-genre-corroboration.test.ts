import { describe, expect, it } from 'vitest';

import {
  projectEventGenres,
  type ArtistCorroborationRecord,
} from '../shared/artist-genre-corroboration-pass';

function identity(
  artistName: string,
  genres: Array<{ genreKey: string; displayName: string }>,
  status: ArtistCorroborationRecord['identityStatus'] = 'corroborated',
): ArtistCorroborationRecord {
  return {
    artistName,
    identityKey: artistName.toLowerCase(),
    identityStatus: status,
    musicBrainzId: 'mb-1',
    discogsId: 'dg-1',
    corroboratingSource: 'musicbrainz+discogs',
    identitySignals: ['test'],
    rawGenreLabels: { musicbrainz: genres.map((genre) => genre.displayName), discogs: [] },
    normalizedGenres: genres,
    projectionDecision: genres.length > 0 ? 'published' : 'rejected',
  };
}

describe('artist genre corroboration projection', () => {
  it('requires multi-act consensus for derived event genres', () => {
    const identities = new Map<string, ArtistCorroborationRecord>([
      [
        'hitmilow',
        identity('HITMiLOW', [
          { genreKey: 'hardtechno', displayName: 'Hard Techno' },
          { genreKey: 'techno', displayName: 'Techno' },
        ]),
      ],
      ['prada2000', identity('PRADA2000', [])],
      ['mika heggemann', identity('MIKA HEGGEMANN', [])],
    ]);

    const projection = projectEventGenres({
      sourceEventKey: 'polyamor',
      lineup: ['HITMiLOW', 'PRADA2000', 'MIKA HEGGEMANN'],
      officialGenres: [],
      identities,
    });

    expect(projection.genres).toHaveLength(0);
    expect(projection.rejectionReasons).toContain('artist_genre_consensus_not_met');
  });

  it('rejects ambiguous artist identities for single-act genre projection', () => {
    const identities = new Map<string, ArtistCorroborationRecord>([
      [
        'clark kent',
        identity(
          'Clark Kent',
          [{ genreKey: 'hip-hop', displayName: 'Hip Hop' }],
          'ambiguous',
        ),
      ],
    ]);

    const projection = projectEventGenres({
      sourceEventKey: 'kitkat',
      lineup: ['Clark Kent'],
      officialGenres: [],
      identities,
    });

    expect(projection.genres).toHaveLength(0);
  });
});
