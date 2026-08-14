import { useMemo } from 'react';

import { toEventDisplayModelFromSummary } from '@/data/mappers/event-core-display';
import { eventRepository } from '@/data/repositories/registry';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface UsePublishedEventsResult {
  events: EventDisplayModel[];
  isEmpty: boolean;
}

export function usePublishedEvents(): UsePublishedEventsResult {
  const events = useMemo(
    () => eventRepository.getPublishedSummaries().map(toEventDisplayModelFromSummary),
    [],
  );

  return {
    events,
    isEmpty: events.length === 0,
  };
}
