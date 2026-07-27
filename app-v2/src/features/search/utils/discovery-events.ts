import { eventRepository } from '@/features/events';
import { toEventDisplayModel, type EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventFilters } from '@/features/search/constants';
import { applyEventFilters } from '@/features/search/utils/filter-events';

/** Shared discovery query for grid and map surfaces. */
export function getDiscoveryEvents(filters: EventFilters): EventDisplayModel[] {
  return applyEventFilters(eventRepository.getPublishedEvents(), filters).map(toEventDisplayModel);
}
