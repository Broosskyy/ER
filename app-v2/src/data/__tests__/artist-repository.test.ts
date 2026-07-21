import { describe, expect, it } from 'vitest';

import { createLocalArtistDatasource } from '@/data/datasources/local/local-artist-datasource';
import type { ArtistRecord } from '@/data/types/records';

function createArtist(overrides: Partial<ArtistRecord> = {}): ArtistRecord {
  const now = new Date().toISOString();
  return {
    id: 'artist-1',
    name: 'Ben Klock',
    slug: 'ben-klock',
    genreIds: [],
    status: 'published',
    verificationStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('local artist datasource', () => {
  it('filters published artists for public reads', async () => {
    let items = [
      createArtist({ id: 'artist-1', status: 'published' }),
      createArtist({ id: 'artist-2', name: 'Draft Artist', slug: 'draft-artist', status: 'draft' }),
    ];
    const datasource = createLocalArtistDatasource(
      () => items,
      (next) => {
        items = next;
      },
    );

    const published = await datasource.getPublished();
    expect(published).toHaveLength(1);
    expect(published[0]?.id).toBe('artist-1');
    expect(await datasource.getPublishedBySlug('draft-artist')).toBeNull();
    expect(await datasource.getPublishedById('artist-2')).toBeNull();
  });

  it('supports admin list filtering and save/update', async () => {
    let items = [createArtist()];
    const datasource = createLocalArtistDatasource(
      () => items,
      (next) => {
        items = next;
      },
    );

    const listed = await datasource.list({ query: 'klock', status: 'published' });
    expect(listed.total).toBe(1);

    const saved = await datasource.save({
      ...createArtist(),
      bio: 'Updated bio',
      updatedAt: new Date().toISOString(),
    });
    expect(saved.bio).toBe('Updated bio');
    expect((await datasource.getById('artist-1'))?.bio).toBe('Updated bio');
  });
});
