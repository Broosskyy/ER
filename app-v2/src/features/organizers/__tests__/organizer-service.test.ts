import { describe, expect, it } from 'vitest';

import type { OrganizerRecord } from '@/data/types/records';
import { OrganizerService } from '@/features/organizers/services/organizer-service';

function createRepository(initial: OrganizerRecord[] = []) {
  const items = [...initial];
  return {
    list: async () => ({ items, total: items.length, page: 1, pageSize: 50 }),
    getById: async (id: string) => items.find((item) => item.id === id) ?? null,
    getBySlug: async (slug: string) => items.find((item) => item.slug === slug) ?? null,
    getAll: async () => [...items],
    save: async (record: OrganizerRecord) => {
      const index = items.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        items[index] = record;
      } else {
        items.push(record);
      }
      return record;
    },
    delete: async (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) {
        items.splice(index, 1);
      }
    },
    countEventsForOrganizer: async (organizerId: string) =>
      organizerId === 'organizer-used' ? 2 : 0,
    listEventIdsForOrganizer: async (organizerId: string) =>
      organizerId === 'organizer-used' ? ['event-1', 'event-2'] : [],
  };
}

describe('OrganizerService', () => {
  it('creates organizers with generated slugs', async () => {
    const service = new OrganizerService(createRepository());
    const created = await service.create('editor', { name: 'Rave Rebels' });
    expect(created.slug).toBe('rave-rebels');
    expect(created.name).toBe('Rave Rebels');
  });

  it('blocks deletion when events reference the organizer', async () => {
    const service = new OrganizerService(
      createRepository([
        {
          id: 'organizer-used',
          slug: 'used',
          name: 'Used Organizer',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    await expect(service.delete('editor', 'organizer-used')).rejects.toThrow(
      'cannot be deleted',
    );
  });

  it('rejects viewers from creating organizers', async () => {
    const service = new OrganizerService(createRepository());
    await expect(service.create('viewer', { name: 'Blocked' })).rejects.toThrow('permission');
  });
});
