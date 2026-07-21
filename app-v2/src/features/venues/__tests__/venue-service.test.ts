import { describe, expect, it, vi } from 'vitest';

import { VenueService } from '@/features/venues/services/venue-service';
import type { VenueRecord } from '@/data/types/records';

function venue(overrides: Partial<VenueRecord> = {}): VenueRecord {
  const now = new Date().toISOString();
  return {
    id: 'venue-1',
    slug: 'gewoelbe',
    name: 'Gewölbe',
    city: 'Köln',
    country: 'Germany',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('venue service', () => {
  it('rejects viewer mutations', async () => {
    const service = new VenueService({
      list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      getById: async () => null,
      getBySlug: async () => null,
      getAll: async () => [],
      save: async () => venue(),
      delete: async () => {},
      countEventsForVenue: async () => 0,
      listEventIdsForVenue: async () => [],
    });

    await expect(
      service.create('viewer', { name: 'Club', city: 'Köln', country: 'Germany' }),
    ).rejects.toThrow('permission');
  });

  it('prevents deleting venues referenced by events', async () => {
    const service = new VenueService({
      list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      getById: async () => venue(),
      getBySlug: async () => null,
      getAll: async () => [venue()],
      save: async (record) => record,
      delete: vi.fn(),
      countEventsForVenue: async () => 2,
      listEventIdsForVenue: async () => ['event-1', 'event-2'],
    });

    await expect(service.delete('editor', 'venue-1')).rejects.toThrow('cannot be deleted');
  });
});
