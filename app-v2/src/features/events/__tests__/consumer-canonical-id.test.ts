import { describe, expect, it } from 'vitest';

import { EventRepository } from '@/data/repositories/repositories';
import type { Event } from '@/features/events/types/event';

function event(id: string): Event {
  return {
    id,
    slug: id,
    title: `Event ${id}`,
    description: 'Description',
    startDateTime: '2026-08-01T20:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Venue',
    city: 'Berlin',
    country: 'Germany',
    genres: ['Techno'],
    artists: ['DJ'],
    source: 'demo',
    sourceEventId: id,
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('consumer canonical id integration', () => {
  it('resolves legacy ids, deduplicates lists, and keeps saved references addressable', () => {
    const repository = new EventRepository();
    repository.applyCanonicalAliases(new Map([['legacy-1', 'canonical-1']]));
    repository.initializeSync([event('legacy-1'), event('canonical-1')]);

    expect(repository.getEventById('legacy-1')?.id).toBe('canonical-1');
    expect(repository.getPublishedEvents()).toHaveLength(1);
    expect(repository.getPublishedEvents()[0]?.title).toBe('Event canonical-1');
  });

  it('exposes the same canonical dataset across list and detail lookups', () => {
    const repository = new EventRepository();
    repository.initializeSync([event('shared-1')]);
    const listed = repository.getPublishedEvents()[0];
    const detailed = repository.getEventById('shared-1');
    expect(listed?.title).toBe(detailed?.title);
    expect(listed?.venue).toBe(detailed?.venue);
  });
});
