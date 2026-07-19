import { MemoryCache } from '@/core/cache/memory-cache';
import { withRetry } from '@/core/errors/with-retry';
import type {
  AdminEventListParams,
  AdminEventRecord,
  ArtistRecord,
  CityRecord,
  CollectionRecord,
  DashboardStats,
  GenreRecord,
  PaginatedResult,
  SourceRecord,
  VenueRecord,
} from '@/data/types/records';
import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import type { Event } from '@/features/events/types/event';
import { isFeaturedEventId } from '@/features/events/data/home-config';
import { hasValidCoordinates } from '@/features/events/formatting/coordinates';
import {
  EVENT_REFERENCE_DATE,
  isThisMonthEvent,
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';
import type { EventWithCoordinates } from '@/features/events/types/event';
import { isPublishedStatus } from '@/features/events/types/event-status';
import { runDefaultEventPipeline } from '@/features/events/pipeline/run-pipeline';

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
  if (!normalizedQuery) return true;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = buildSearchIndex(event);
  return terms.every((term) => haystack.includes(term));
}

function matchesGenre(event: Event, genre: string | undefined): boolean {
  if (!genre || genre === 'all') return true;
  const genreLabel = genre.replace(/-/g, ' ').toLowerCase();
  return event.genres.some((item) => item.toLowerCase().includes(genreLabel));
}

function matchesCity(event: Event, city: string | undefined): boolean {
  if (!city) return true;
  return event.city.toLowerCase() === city.toLowerCase();
}

function matchesTimeFilters(
  event: Event,
  filters: EventSearchFilters,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  if (filters.thisWeek) return isThisWeekEvent(event, referenceDate);
  if (filters.thisMonth) return isThisMonthEvent(event, referenceDate);
  if (filters.upcoming) return isUpcomingEvent(event, referenceDate);
  return true;
}

export class EventRepository {
  private publishedEvents: Event[] = [];
  private eventsById = new Map<string, Event>();
  private initialized = false;
  private readonly cache = new MemoryCache<Event[]>();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const cached = this.cache.get();
    if (cached) {
      this.setEvents(cached);
      this.initialized = true;
      return;
    }
    const events = await withRetry(() => getDatasourceBundle().events.getPublishedEvents());
    this.cache.set(events);
    this.setEvents(events);
    this.initialized = true;
  }

  initializeSync(events: Event[]): void {
    this.setEvents(events);
    this.initialized = true;
  }

  private setEvents(events: Event[]): void {
    this.publishedEvents = [...events].sort((left, right) =>
      left.startDateTime.localeCompare(right.startDateTime),
    );
    this.eventsById = new Map(this.publishedEvents.map((event) => [event.id, event]));
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new Error('EventRepository is not initialized. Call initialize() first.');
    }
  }

  getPublishedEvents(): Event[] {
    this.ensureReady();
    return [...this.publishedEvents];
  }

  getEventById(id: string): Event | undefined {
    this.ensureReady();
    return this.eventsById.get(id);
  }

  getFeaturedEvents(): Event[] {
    return this.getPublishedEvents().filter((event) => isFeaturedEventId(event.id));
  }

  getSecondaryHomeEvents(): Event[] {
    return this.getPublishedEvents().filter((event) => !isFeaturedEventId(event.id));
  }

  getUpcomingEvents(referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.getPublishedEvents().filter((event) => isUpcomingEvent(event, referenceDate));
  }

  getEventsThisWeek(referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.getPublishedEvents().filter((event) => isThisWeekEvent(event, referenceDate));
  }

  getEventsThisMonth(referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.getPublishedEvents().filter((event) => isThisMonthEvent(event, referenceDate));
  }

  getEventsByCity(city: string): Event[] {
    return this.getPublishedEvents().filter(
      (event) => event.city.toLowerCase() === city.toLowerCase(),
    );
  }

  getEventsByGenre(genre: string): Event[] {
    return this.searchEvents({ genre });
  }

  getEventsForMap(): EventWithCoordinates[] {
    return this.getPublishedEvents().filter((event) =>
      hasValidCoordinates(event.latitude, event.longitude),
    ) as EventWithCoordinates[];
  }

  searchEvents(filters: EventSearchFilters, referenceDate: Date = EVENT_REFERENCE_DATE): Event[] {
    return this.getPublishedEvents().filter(
      (event) =>
        matchesQuery(event, filters.query) &&
        matchesGenre(event, filters.genre) &&
        matchesCity(event, filters.city) &&
        matchesTimeFilters(event, filters, referenceDate),
    );
  }

  hasPublishedEvent(id: string): boolean {
    const event = this.getEventById(id);
    return event !== undefined && isPublishedStatus(event.status);
  }

  async refresh(): Promise<void> {
    this.cache.invalidate();
    this.initialized = false;
    await this.initialize();
  }

  static createDefault(): EventRepository {
    const repository = new EventRepository();
    const report = runDefaultEventPipeline();
    repository.initializeSync(report.publishedEvents);
    return repository;
  }
}

export class AdminEventRepository {
  async list(params: AdminEventListParams): Promise<PaginatedResult<AdminEventRecord>> {
    return getDatasourceBundle().events.listEvents(params);
  }

  async getById(id: string): Promise<AdminEventRecord | null> {
    const events = await getDatasourceBundle().events.getAllEvents();
    return events.find((event) => event.id === id) ?? null;
  }

  async save(record: AdminEventRecord): Promise<AdminEventRecord> {
    return getDatasourceBundle().events.saveEvent(record);
  }

  async delete(id: string): Promise<void> {
    return getDatasourceBundle().events.deleteEvent(id);
  }
}

export class GenreRepository {
  getAll(): Promise<GenreRecord[]> {
    return getDatasourceBundle().genres.getAll();
  }
  getActive(): Promise<GenreRecord[]> {
    return getDatasourceBundle().genres.getActive();
  }
}

export class CityRepository {
  getAll(): Promise<CityRecord[]> {
    return getDatasourceBundle().cities.getAll();
  }
  getActive(): Promise<CityRecord[]> {
    return getDatasourceBundle().cities.getActive();
  }
}

export class VenueRepository {
  getAll(): Promise<VenueRecord[]> {
    return getDatasourceBundle().venues.getAll();
  }
}

export class ArtistRepository {
  getAll(): Promise<ArtistRecord[]> {
    return getDatasourceBundle().artists.getAll();
  }
}

export class CollectionRepository {
  getAll(): Promise<CollectionRecord[]> {
    return getDatasourceBundle().collections.getAll();
  }
  getActive(): Promise<CollectionRecord[]> {
    return getDatasourceBundle().collections.getActive();
  }
}

export class SourceRepository {
  getAll(): Promise<SourceRecord[]> {
    return getDatasourceBundle().sources.getAll();
  }
}

export class StatsRepository {
  getDashboardStats(): Promise<DashboardStats> {
    return getDatasourceBundle().stats.getDashboardStats();
  }
}
