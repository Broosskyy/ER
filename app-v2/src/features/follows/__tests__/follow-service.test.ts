import { describe, expect, it } from 'vitest';

import {
  FollowService,
  InMemoryFollowStorage,
  type FollowRecord,
} from '@/features/follows/follow-service';

describe('FollowService', () => {
  it('follows and unfollows idempotently', async () => {
    const service = new FollowService({ storage: new InMemoryFollowStorage() });

    await service.follow('venue', 'bootshaus');
    await service.follow('venue', 'bootshaus');
    expect(await service.isFollowing('venue', 'bootshaus')).toBe(true);
    expect((await service.list('venue')).length).toBe(1);

    await service.unfollow('venue', 'bootshaus');
    await service.unfollow('venue', 'bootshaus');
    expect(await service.isFollowing('venue', 'bootshaus')).toBe(false);
  });

  it('persists through the storage adapter', async () => {
    const storage = new InMemoryFollowStorage();
    const first = new FollowService({ storage });
    await first.follow('artist', 'westbam');

    const second = new FollowService({ storage });
    expect(await second.isFollowing('artist', 'westbam')).toBe(true);
  });

  it('counts followers from storage when available', async () => {
    const records: FollowRecord[] = [];
    const storage = {
      async load() {
        return [...records];
      },
      async save(next: FollowRecord[]) {
        records.splice(0, records.length, ...next);
      },
      async countFollowers() {
        return 12;
      },
    };

    const service = new FollowService({ storage });
    expect(await service.getFollowerCount('organizer', 'lehmann')).toBe(12);
  });
});
