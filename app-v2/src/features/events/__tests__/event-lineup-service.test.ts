import { describe, expect, it, vi } from 'vitest';

import { EventLineupService } from '@/features/events/services/event-lineup-service';
import type { ArtistRecord } from '@/data/types/records';

function artist(id: string, name: string): ArtistRecord {
  const now = new Date().toISOString();
  return {
    id,
    name,
    slug: id,
    genreIds: [],
    status: 'published',
    verificationStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
  };
}

describe('event lineup service', () => {
  it('rejects viewer mutations', async () => {
    const service = new EventLineupService(
      {
        getLineupForEvent: async () => [],
        replaceEventLineup: async () => [],
      },
      async () => [artist('a1', 'Ben Klock')],
      async () => ({ status: 'draft' }),
    );

    await expect(
      service.replaceEventLineup('viewer', 'event-1', [{ artistId: 'a1', billingRole: 'headliner' }]),
    ).rejects.toThrow('permission');
  });

  it('replaces lineup for editors on draft events', async () => {
    const replaceEventLineup = vi.fn(async () => []);
    const service = new EventLineupService(
      {
        getLineupForEvent: async () => [],
        replaceEventLineup,
      },
      async () => [artist('a1', 'Ben Klock'), artist('a2', 'Dax J')],
      async () => ({ status: 'draft' }),
    );

    await service.replaceEventLineup('editor', 'event-1', [
      { artistId: 'a1', billingRole: 'headliner' },
      { artistId: 'a2', billingRole: 'support' },
    ]);

    expect(replaceEventLineup).toHaveBeenCalledWith('event-1', [
      { artistId: 'a1', billingRole: 'headliner' },
      { artistId: 'a2', billingRole: 'support' },
    ]);
  });

  it('blocks lineup edits on contributor review events outside moderation', async () => {
    const service = new EventLineupService(
      {
        getLineupForEvent: async () => [],
        replaceEventLineup: async () => [],
      },
      async () => [artist('a1', 'Ben Klock')],
      async () => ({ status: 'review', createdBy: 'user-1' }),
    );

    await expect(
      service.replaceEventLineup('editor', 'event-1', [{ artistId: 'a1', billingRole: 'headliner' }]),
    ).rejects.toThrow('review workflow');
  });
});
