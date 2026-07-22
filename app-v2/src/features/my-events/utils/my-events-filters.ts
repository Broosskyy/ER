import type { AdminEventStatus } from '@/data/types/records';

export type MyEventsFilter = 'all' | AdminEventStatus;

export const MY_EVENTS_FILTER_OPTIONS: MyEventsFilter[] = [
  'all',
  'draft',
  'review',
  'published',
  'rejected',
];

export function filterMyEventsByStatus<T extends { status: AdminEventStatus }>(
  events: T[],
  filter: MyEventsFilter,
): T[] {
  if (filter === 'all') {
    return events;
  }

  return events.filter((event) => event.status === filter);
}
