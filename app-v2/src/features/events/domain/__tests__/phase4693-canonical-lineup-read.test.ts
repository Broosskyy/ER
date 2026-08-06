import { describe, expect, it } from 'vitest';

import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  readCanonicalLineup,
  resolveKnownArtistNamesFromCanonical,
} from '@/features/events/domain/canonical-lineup-read';
import { resolveKnownArtistNames } from '@/features/events/formatting/canonical-event-projection';
import { PROJECTION_PATH_INVENTORY } from '@/features/events/domain/projection-path-inventory';

function soloEntry(name: string, artistId: string, order: number): ResolvedCanonicalLineupEntry {
  return {
    order,
    artists: [name],
    artistIds: [artistId],
    billingRelation: 'SOLO',
    confidence: 0.9,
  };
}

describe('phase 4693 canonical projection read', () => {
  it('inventory paths do not use primary artist or title inference fallbacks', () => {
    for (const path of PROJECTION_PATH_INVENTORY) {
      expect(path.usesPrimaryArtistFallback).toBe(false);
      expect(path.usesTitleInference).toBe(false);
    }
  });

  it('prefers structured entries over compatibility lineup', () => {
    const result = readCanonicalLineup({
      structuredEntries: [soloEntry('MAURO', 'artist-mauro', 0)],
      compatibilityLineup: [
        {
          id: 'ea-1',
          artist: {
            id: 'artist-stale',
            name: 'STALE ARTIST',
            slug: 'stale',
            genreIds: [],
            status: 'published',
            verificationStatus: 'verified',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          billingRole: 'support',
          sortOrder: 0,
        },
      ],
    });

    expect(result.state).toBe('structured');
    expect(result.artistNames).toEqual(['MAURO']);
    expect(result.lineupEntries).toHaveLength(1);
  });

  it('does not fall back to primary artist when compatibility lineup is empty', () => {
    const result = readCanonicalLineup({
      structuredEntries: [],
      compatibilityLineup: [],
    });
    expect(result.state).toBe('empty');
    expect(result.artistNames).toEqual([]);
    expect(result.artistIds).toEqual([]);
  });

  it('filters prose blobs from compatibility lineup', () => {
    const prose =
      'NIKLAS DEEFABIAN FARELLOLIVER MAGENTATEKNOCLASHDANTH Einlass ab 18 Jahren / Age for admission 18 years';
    const result = readCanonicalLineup({
      structuredEntries: [],
      compatibilityLineup: [
        {
          id: 'ea-1',
          artist: {
            id: 'artist-prose',
            name: prose,
            slug: 'prose',
            genreIds: [],
            status: 'published',
            verificationStatus: 'verified',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          billingRole: 'support',
          sortOrder: 0,
        },
      ],
    });

    expect(result.state).toBe('empty');
    expect(result.artistNames).toEqual([]);
  });

  it('resolveKnownArtistNames never uses title inference', () => {
    expect(
      resolveKnownArtistNames({
        title: 'NIGHTSWITHUS presents LEVI',
        artists: [],
        lineup: [],
      }),
    ).toEqual([]);
  });

  it('resolveKnownArtistNamesFromCanonical uses structured entry names', () => {
    expect(
      resolveKnownArtistNamesFromCanonical({
        lineupEntries: [
          {
            order: 0,
            artists: ['LEVI'],
            billingRelation: 'SOLO',
          },
        ],
        artists: [],
        lineup: [],
      }),
    ).toEqual(['LEVI']);
  });
});
