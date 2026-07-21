import { describe, expect, it } from 'vitest';

import { ArtistService } from '@/features/artists/services/artist-service';
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

function createServiceHarness(initial: ArtistRecord[] = []) {
  let items = [...initial];
  const datasource = createLocalArtistDatasource(
    () => items,
    (next) => {
      items = next;
    },
  );

  const publicRepository = {
    getPublishedBySlug: (slug: string) => datasource.getPublishedBySlug(slug),
    getPublishedById: (id: string) => datasource.getPublishedById(id),
  };
  const adminRepository = {
    list: (params: Parameters<typeof datasource.list>[0]) => datasource.list(params),
    getById: (id: string) => datasource.getById(id),
    getAll: () => datasource.getAll(),
    save: (record: ArtistRecord) => datasource.save(record),
  };

  return {
    items,
    service: new ArtistService(publicRepository, adminRepository),
  };
}

describe('artist service', () => {
  it('creates draft artists for editors', async () => {
    const { service } = createServiceHarness();
    const saved = await service.create('editor', {
      name: 'Dax J',
      status: 'draft',
    });

    expect(saved.slug).toBe('dax-j');
    expect(saved.status).toBe('draft');
  });

  it('blocks viewer mutations', async () => {
    const { service } = createServiceHarness();
    await expect(
      service.create('viewer', {
        name: 'Blocked Artist',
      }),
    ).rejects.toThrow('permission');
  });

  it('prevents exact duplicate names', async () => {
    const { service } = createServiceHarness([createArtist()]);
    await expect(
      service.create('editor', {
        name: 'Ben Klock',
      }),
    ).rejects.toThrow('already exists');
  });

  it('requires admin role to publish on create', async () => {
    const { service } = createServiceHarness();
    await expect(
      service.create('editor', {
        name: 'Published Artist',
        status: 'published',
      }),
    ).rejects.toThrow('publish');
  });

  it('allows admin to verify artists', async () => {
    const { service } = createServiceHarness([createArtist({ status: 'draft' })]);
    const saved = await service.update('admin', {
      id: 'artist-1',
      name: 'Ben Klock',
      verificationStatus: 'verified',
      status: 'published',
    });

    expect(saved.verificationStatus).toBe('verified');
    expect(saved.status).toBe('published');
  });

  it('blocks editor verification changes', async () => {
    const { service } = createServiceHarness([createArtist()]);
    await expect(
      service.update('editor', {
        id: 'artist-1',
        name: 'Ben Klock',
        verificationStatus: 'verified',
      }),
    ).rejects.toThrow('verification');
  });
});
