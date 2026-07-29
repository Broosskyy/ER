import type { Event } from '@/features/events/types/event';

import type { EventLifecycleInput } from './lifecycle-types';

function mapEditorialStatus(status: Event['status']): EventLifecycleInput['editorialStatus'] {
  if (status === 'review') return 'review';
  if (status === 'draft') return 'draft';
  if (status === 'rejected') return 'rejected';
  if (status === 'archived') return 'archived';
  return 'published';
}

export function toEventLifecycleInput(event: Event): EventLifecycleInput {
  return {
    editorialStatus: mapEditorialStatus(event.status),
    timezone: event.timezone || 'Europe/Berlin',
    startAt: event.startDateTime,
    endAt: event.endDateTime,
    doorsOpenAt: event.doorsOpenAt,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
    cancelledAt: event.cancelledAt,
    postponedAt: event.postponedAt,
    publishedAt: event.publishedAt ?? event.createdAt,
    ticketStatus: event.ticketStatus,
  };
}
