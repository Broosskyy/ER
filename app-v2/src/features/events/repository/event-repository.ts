import { isFeaturedEventId } from '../data/home-config';
import { hasValidCoordinates } from '../formatting/coordinates';
import {
  EVENT_REFERENCE_DATE,
  isThisMonthEvent,
  isThisWeekEvent,
  isUpcomingEvent,
} from '../formatting/date-time';
import { runDefaultEventPipeline } from '../pipeline/run-pipeline';
import type { Event, EventWithCoordinates } from '../types/event';
import { isPublishedStatus } from '../types/event-status';

export interface EventSearchFilters {
  query?: string;
  genre?: string;
  upcoming?: boolean;
  thisWeek?: boolean;
  thisMonth?: boolean;
  city?: string;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

function buildSearchIndex(event: Event): string {
  return [event.title, event.venue, event.city, ...event.genres, ...event.artists]
    .join(' ')
    .toLowerCase();
}

function matchesQuery(event: Event, query: string | undefined): boolean {
  const normalizedQuery = normalizeSearchTerm(query ?? '');

  if (!normalizedQuery) {
    return true;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = buildSearchIndex(event);

  return terms.every((term) => haystack.includes(term));
}

function matchesGenre(event: Event, genre: string | undefined): boolean {
  if (!genre || genre === 'all') {
    return true;
  }

  const genreLabel = genre.replace(/-/g, ' ').toLowerCase();
  return event.genres.some((item) => item.toLowerCase().includes(genreLabel));
}

function matchesCity(event: Event, city: string | undefined): boolean {
  if (!city) {
    return true;
  }

  return event.city.toLowerCase() === city.toLowerCase();
}

function matchesTimeFilters(
  event: Event,
  filters: EventSearchFilters,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  if (filters.thisWeek) {
    return isThisWeekEvent(event, referenceDate);
  }

  if (filters.thisMonth) {
    return isThisMonthEvent(event, referenceDate);
  }

  if (filters.upcoming) {
    return isUpcomingEvent(event, referenceDate);
  }

  return true;
}

export class EventRepository {
  private readonly publishedEvents: Event[];
  private readonly eventsById: Map<string, Event>;

  constructor(publishedEvents: Event[]) {
    this.publishedEvents = [...publishedEvents].sort((left, right) =>
      left.startDateTime.localeCompare(right.startDateTime),
    );
    this.eventsById = new Map(this.publishedEvents.map((event) => [event.id, event]));
  }

  static createDefault(): EventRepository {
    const report = runDefaultEventPipeline();
    return new EventRepository(report.publishedEvents);
  }

  getPublishedEvents(): Event[] {
    return [...this.publishedEvents];
  }

  getEventById(id: string): Event | undefined {
    return this.eventsById.get(id);
  }

  getFeaturedEvents(): Event[] {
    return this.publishedEvents.filter((event) => isFeaturedEventId(event.id));
  }

  getSecondaryHomeEvents(): Event[] {
    return this.publishedEvents.filter((event) => !isFeaturedEventId(event.id));
  }

  getUpcomingEvents(referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.publishedEvents.filter((event) => isUpcomingEvent(event, referenceDate));
  }

  getEventsThisWeek(referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.publishedEvents.filter((event) => isThisWeekEvent(event, referenceDate));
  }

  getEventsThisMonth(referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.publishedEvents.filter((event) => isThisMonthEvent(event, referenceDate));
  }

  getEventsByCity(city: string): Event[] {
    return this.publishedEvents.filter(
      (event) => event.city.toLowerCase() === city.toLowerCase(),
    );
  }

  getEventsByGenre(genre: string): Event[] {
    return this.searchEvents({ genre });
  }

  getEventsForMap(): EventWithCoordinates[] {
    return this.publishedEvents.filter((event) =>
      hasValidCoordinates(event.latitude, event.longitude),
    ) as EventWithCoordinates[];
  }

  searchEvents(filters: EventSearchFilters, referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.publishedEvents.filter(
      (event) =>
        matchesQuery(event, filters.query) &&
        matchesGenre(event, filters.genre) &&
        matchesCity(event, filters.city) &&
        matchesTimeFilters(event, filters, referenceDate),
    );
  }

  hasPublishedEvent(id: string): boolean {
    const event = this.eventsById.get(id);
    return event !== undefined && isPublishedStatus(event.status);
  }
}

export const eventRepository = EventRepository.createDefault();
