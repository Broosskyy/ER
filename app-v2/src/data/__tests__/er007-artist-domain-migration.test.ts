import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapArtistRecordToRow, mapArtistRowToRecord } from '@/data/mappers/artist-mapper';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260733000000_er007_artist_domain_foundation.sql',
);

describe('ER-007 artist domain migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('extends artists with canonical domain fields', () => {
    expect(sql).toContain('add column if not exists slug text');
    expect(sql).toContain('verification_status text not null default \'unverified\'');
    expect(sql).toContain('create unique index if not exists artists_slug_idx');
  });

  it('scopes public reads to published artists', () => {
    expect(sql).toContain('drop policy if exists "anon_read_artists"');
    expect(sql).toContain('create policy "anon_read_published_artists"');
    expect(sql).toContain("status = 'published'");
  });

  it('replaces broad artist writes with role-scoped policies', () => {
    expect(sql).toContain('drop policy if exists "admin_manage_artists"');
    expect(sql).toContain('create policy "admin_insert_artists"');
    expect(sql).toContain('create policy "admin_update_artists"');
    expect(sql).toContain('enforce_admin_artist_sensitive_rules');
  });
});

describe('artist mapper', () => {
  it('maps snake_case database rows to domain records', () => {
    const record = mapArtistRowToRecord({
      id: 'artist-1',
      name: 'Ben Klock',
      slug: 'ben-klock',
      bio: 'Techno DJ',
      image_url: 'https://example.com/ben.jpg',
      genre_ids: ['techno'],
      country: 'Germany',
      city: 'Berlin',
      website: 'https://benklock.com',
      instagram: 'https://instagram.com/benklock',
      facebook: null,
      soundcloud: null,
      spotify: null,
      status: 'published',
      verification_status: 'verified',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });

    expect(record.imageUrl).toBe('https://example.com/ben.jpg');
    expect(record.genreIds).toEqual(['techno']);
    expect(record.verificationStatus).toBe('verified');
  });

  it('maps domain records back to database rows', () => {
    const row = mapArtistRecordToRow({
      id: 'artist-1',
      name: 'Ben Klock',
      slug: 'ben-klock',
      genreIds: ['techno'],
      status: 'draft',
      verificationStatus: 'unverified',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(row.genre_ids).toEqual(['techno']);
    expect(row.verification_status).toBe('unverified');
  });
});
