import { describe, expect, it, vi } from 'vitest';

import { fetchPublishedEventDetails } from '@/data/repositories/event-core-read';
import { EventRepository } from '@/data/repositories/repositories';

describe('useEventCoreDetail states via repository', () => {
  it('exposes ready, empty and not-found repository states', async () => {
    const repository = new EventRepository();
    expect(repository.getPublishedSummaries()).toEqual([]);
    expect(repository.getPublishedDetail('missing')).toBeUndefined();

    repository.initializeSync([
      {
        id: 'event-1',
        title: 'Eternal Rave Core Test',
        startsAt: '2026-09-05T18:00:00Z',
        endsAt: '2026-09-06T04:00:00Z',
        timezone: 'Europe/Berlin',
        imageUrl: null,
        organizerName: 'Eternal Rave Test',
        venue: null,
        genres: [],
        primaryTicket: null,
        description: 'Roundtrip description',
        officialUrl: null,
        publishedAt: '2026-08-14T08:00:00Z',
        lineup: [],
        tickets: [],
      },
    ]);

    expect(repository.getPublishedSummaries()).toHaveLength(1);
    expect(repository.getPublishedDetail('event-1')?.description).toBe('Roundtrip description');
  });
});

describe('event-core read queries', () => {
  it('does not query event_sources', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          in: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      };
    });

    await fetchPublishedEventDetails({ from: fromSpy } as never);
    expect(fromSpy).not.toHaveBeenCalledWith('event_sources');
  });
});
