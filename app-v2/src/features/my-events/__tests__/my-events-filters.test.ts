import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  filterMyEventsByStatus,
  MY_EVENTS_FILTER_OPTIONS,
} from '@/features/my-events/utils/my-events-filters';

function event(status: AdminEventRecord['status'], id: string): AdminEventRecord {
  return {
    id,
    title: id,
    description: '',
    genreId: 'techno',
    cityId: 'koeln',
    startDate: '2026-09-12T21:00:00.000Z',
    status,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

describe('my events filters', () => {
  const events = [
    event('draft', 'draft-1'),
    event('review', 'review-1'),
    event('published', 'published-1'),
    event('rejected', 'rejected-1'),
    event('archived', 'archived-1'),
  ];

  it('exposes the default filter options', () => {
    expect(MY_EVENTS_FILTER_OPTIONS).toEqual(['all', 'draft', 'review', 'published', 'rejected']);
  });

  it('returns all events for the all filter', () => {
    expect(filterMyEventsByStatus(events, 'all')).toHaveLength(5);
  });

  it('filters by status', () => {
    expect(filterMyEventsByStatus(events, 'draft').map((entry) => entry.id)).toEqual(['draft-1']);
    expect(filterMyEventsByStatus(events, 'review').map((entry) => entry.id)).toEqual(['review-1']);
    expect(filterMyEventsByStatus(events, 'published').map((entry) => entry.id)).toEqual([
      'published-1',
    ]);
  });
});
