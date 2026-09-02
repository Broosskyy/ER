import { useMemo } from 'react';

import { toEventDisplayModelFromSummary } from '@/data/mappers/event-core-display';
import { eventRepository } from '@/data/repositories/registry';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/consumer-discovery-feed';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface UsePublishedEventsResult {
  events: EventDisplayModel[];
  isEmpty: boolean;
}

export function usePublishedEvents(): UsePublishedEventsResult {
  const events = useMemo(() => {
    const feed = getDiscoverablePublishedEvents(eventRepository.getPublishedSummaries());
    eventRepository.applyCanonicalAliases(feed.canonicalAliases);
    return feed.events.map(toEventDisplayModelFromSummary);
  }, []);

  return {
    events,
    isEmpty: events.length === 0,
  };
}
