import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mapEventArtistRowToRecord,
  mapEventArtistRowsToLineup,
  type EventArtistRow,
} from '@/data/mappers/event-lineup-mapper';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260734000000_er008_multi_artist_lineup_foundation.sql',
);

describe('ER-008 multi-artist lineup migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates event_artists with constraints and backfill', () => {
    expect(sql).toContain('create table if not exists public.event_artists');
    expect(sql).toContain('unique (event_id, artist_id)');
    expect(sql).toContain("billing_role in ('headliner', 'support', 'special_guest', 'other')");
    expect(sql).toContain("'headliner', 0");
    expect(sql).toContain('on delete cascade');
    expect(sql).toContain('on delete restrict');
  });

  it('scopes public reads to published events only', () => {
    expect(sql).toContain('create policy "anon_read_published_event_lineups"');
    expect(sql).toContain("e.status = 'published'");
  });

  it('protects contributor review lineups from non-admin mutations', () => {
    expect(sql).toContain('enforce_event_artists_mutation_rules');
    expect(sql).toContain('contributor_review_lineup_requires_admin_role');
  });
});

describe('event lineup mapper', () => {
  it('maps rows to ordered lineup artists', () => {
    const rows: EventArtistRow[] = [
      {
        id: 'ea-1',
        event_id: 'event-1',
        artist_id: 'artist-2',
        billing_role: 'support',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        artists: {
          id: 'artist-2',
          name: 'Dax J',
          slug: 'dax-j',
          genre_ids: [],
          status: 'published',
          verification_status: 'unverified',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'ea-2',
        event_id: 'event-1',
        artist_id: 'artist-1',
        billing_role: 'headliner',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        artists: {
          id: 'artist-1',
          name: 'Ben Klock',
          slug: 'ben-klock',
          genre_ids: [],
          status: 'published',
          verification_status: 'verified',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      },
    ];

    const lineup = mapEventArtistRowsToLineup(rows);
    expect(lineup.map((entry) => entry.artist.name)).toEqual(['Ben Klock', 'Dax J']);
    expect(mapEventArtistRowToRecord(rows[1]!).eventId).toBe('event-1');
  });
});
