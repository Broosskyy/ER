/**
 * @deprecated Use `eventRepository` and `EventDisplayModel` from the events feature module.
 * Kept as a compatibility layer for gradual migration.
 */
import { HOME_FILTER_CHIPS, type HomeFilterChipId } from '../data/home-config';
import {
  type EventDisplayModel,
  formatEventDateTime,
  formatEventTimeRange,
  hasMapCoordinates,
  toEventDisplayModel,
} from '../formatting/display-event';
import { eventRepository } from '../repository/event-repository';

export type DemoEvent = EventDisplayModel;

export { HOME_FILTER_CHIPS, type HomeFilterChipId };

export function getDemoEventById(id: string): DemoEvent | undefined {
  const event = eventRepository.getEventById(id);
  return event ? toEventDisplayModel(event) : undefined;
}

export function getFeaturedDemoEvents(): DemoEvent[] {
  return eventRepository.getFeaturedEvents().map(toEventDisplayModel);
}

export function getTonightDemoEvents(): DemoEvent[] {
  return eventRepository.getSecondaryHomeEvents().map(toEventDisplayModel);
}

export function getAllDemoEvents(): DemoEvent[] {
  return eventRepository.getPublishedEvents().map(toEventDisplayModel);
}

export function getMapDemoEvents(): (DemoEvent & { latitude: number; longitude: number })[] {
  return eventRepository.getEventsForMap().map(toEventDisplayModel) as (DemoEvent & {
    latitude: number;
    longitude: number;
  })[];
}

export { formatEventDateTime, formatEventTimeRange, hasMapCoordinates };
