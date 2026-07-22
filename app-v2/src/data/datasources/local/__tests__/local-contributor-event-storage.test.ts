import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadPersistedContributorEvents,
  savePersistedContributorEvents,
} from '@/data/datasources/local/local-contributor-event-storage';
import type { AdminEventRecord } from '@/data/types/records';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (key: string) => Promise.resolve(storage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      storage.delete(key);
      return Promise.resolve();
    },
  },
}));

const sampleDraft: AdminEventRecord = {
  id: 'draft-1',
  title: 'Persisted Rave',
  description: 'Test',
  status: 'draft',
  startDate: '2026-07-21',
  createdBy: 'user-1',
  createdAt: '2026-07-21T10:00:00.000Z',
  updatedAt: '2026-07-21T10:00:00.000Z',
};

describe('local contributor event storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('persists and reloads contributor drafts', async () => {
    await savePersistedContributorEvents([sampleDraft]);
    const loaded = await loadPersistedContributorEvents();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('draft-1');
    expect(loaded[0]?.createdBy).toBe('user-1');
  });

  it('filters out records without createdBy', async () => {
    await savePersistedContributorEvents([
      sampleDraft,
      { ...sampleDraft, id: 'admin-1', createdBy: undefined },
    ]);

    const loaded = await loadPersistedContributorEvents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('draft-1');
  });
});
