import { describe, expect, it, vi } from 'vitest';

import type { ArtistRecord } from '@/data/types/records';
import { resolveArtistIdsForNames } from '@/features/import/services/import-title-lineup-resolver';
import type { ImportRecord } from '@/features/import/models/types';
import type { MatchingCatalog } from '@/features/import/matching/match-result';

describe('resolveArtistIdsForNames structured lineup publish', () => {
  const catalog: MatchingCatalog = {
    events: [],
    venues: [],
    cities: [],
    genres: [],
    artists: [],
    organizers: [],
  };

  const record = {
    id: 'rec-1',
    sourceId: 'source-ticket-io-lehmannclub',
    externalId: 'https://lehmannclub.ticket.io/test/',
    normalizedPayload: {
      title: 'LEHMANN Clubnacht w/ ÜBERREST, MILA BLACK, RAPHAEL DINCSOY',
      startDate: '2026-09-01T22:00:00.000Z',
      artistNames: ['ÜBERREST', 'MILA BLACK', 'RAPHAEL DINCSOY', 'SOURCE CODE', 'NKR'],
    },
    status: 'imported',
    importJobId: 'job-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as ImportRecord;

  it('creates unverified artists for structured multi-artist lineups', async () => {
    const saved: ArtistRecord[] = [];
    const result = await resolveArtistIdsForNames({
      names: ['ÜBERREST', 'MILA BLACK', 'RAPHAEL DINCSOY'],
      record,
      catalog,
      allArtists: [],
      saveArtist: async (artist) => {
        saved.push(artist);
        return artist;
      },
      createUnverifiedForUnmatched: true,
    });

    expect(result.artistIds).toHaveLength(3);
    expect(saved).toHaveLength(3);
    expect(saved.every((artist) => artist.verificationStatus === 'unverified')).toBe(true);
  });

  it('does not auto-create more than two artists for title inference mode', async () => {
    const saveArtist = vi.fn(async (artist: ArtistRecord) => artist);
    const result = await resolveArtistIdsForNames({
      names: ['Artist A', 'Artist B', 'Artist C'],
      record,
      catalog,
      allArtists: [],
      saveArtist,
      createUnverifiedForUnmatched: false,
    });

    expect(result.artistIds).toHaveLength(0);
    expect(saveArtist).not.toHaveBeenCalled();
  });
});
