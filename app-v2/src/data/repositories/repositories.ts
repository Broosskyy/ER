import { MemoryCache } from '@/core/cache/memory-cache';
import { AppError } from '@/core/errors/app-error';
import { withRetry } from '@/core/errors/with-retry';
import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import type {
  AdminEventListParams,
  AdminEventRecord,
  ArtistRecord,
  ArtistListParams,
  CityRecord,
  CollectionRecord,
  DashboardStats,
  GenreRecord,
  PaginatedResult,
  SourceRecord,
  VenueRecord,
  VenueListParams,
  OrganizerRecord,
  OrganizerListParams,
  SourceListParams,
} from '@/data/types/records';
import {
  assertValidAdminEditorialTransition,
  canAdminModerateTransition,
  isContributorReviewEvent,
} from '@/features/admin/constants/admin-event-status';
import { isFeaturedEventId } from '@/features/events/data/home-config';
import type { EventLineupInput , EventLineupArtist } from '@/features/events/domain/event-lineup';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { hasValidCoordinates } from '@/features/events/formatting/coordinates';
import {
  EVENT_REFERENCE_DATE,
  isThisMonthEvent,
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';
import { runDefaultEventPipeline } from '@/features/events/pipeline/run-pipeline';
import type { Event , EventWithCoordinates } from '@/features/events/types/event';
import { isPublishedStatus } from '@/features/events/types/event-status';
import { buildEventSearchIndex } from '@/features/search/constants';

export interface AdminEventSaveContext {
  source?: 'cms' | 'moderation' | 'import';
}

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
  return buildEventSearchIndex(event);
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
  private aliasMap = new Map<string, string>();

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
    const deduped = new Map<string, Event>();
    for (const event of events) {
      const canonicalId = this.resolveCanonicalId(event.id);
      const normalized = canonicalId === event.id ? event : { ...event, id: canonicalId };
      const existing = deduped.get(canonicalId);
      if (!existing || event.id === canonicalId) {
        deduped.set(canonicalId, normalized);
      }
    }
    this.publishedEvents = [...deduped.values()].sort((left, right) =>
      left.startDateTime.localeCompare(right.startDateTime),
    );
    this.eventsById = new Map(this.publishedEvents.map((event) => [event.id, event]));
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new Error('EventRepository is not initialized. Call initialize() first.');
    }
  }

  /** @internal Used by app bootstrap tests only. */
  resetForTesting(): void {
    this.initialized = false;
    this.publishedEvents = [];
    this.eventsById = new Map();
    this.aliasMap = new Map();
    this.cache.invalidate();
  }

  applyCanonicalAliases(aliases: Map<string, string>): void {
    this.aliasMap = new Map(aliases);
    if (this.initialized) {
      this.setEvents(this.publishedEvents);
    }
  }

  resolveCanonicalId(eventId: string): string {
    return this.aliasMap.get(eventId) ?? eventId;
  }

  getPublishedEvents(): Event[] {
    this.ensureReady();
    return [...this.publishedEvents];
  }

  getEventById(id: string): Event | undefined {
    this.ensureReady();
    const canonicalId = this.resolveCanonicalId(id);
    return this.eventsById.get(canonicalId);
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
  private sourceEventIdResolver?: (sourceId: string) => Promise<Set<string>>;

  bindSourceEventIdResolver(resolver: (sourceId: string) => Promise<Set<string>>): void {
    this.sourceEventIdResolver = resolver;
  }

  async list(params: AdminEventListParams): Promise<PaginatedResult<AdminEventRecord>> {
    let listParams = params;
    if (params.sourceId && this.sourceEventIdResolver) {
      const originEventIds = [...(await this.sourceEventIdResolver(params.sourceId))];
      listParams = { ...params, originEventIds };
    }
    return getDatasourceBundle().events.listEvents(listParams);
  }

  async getById(id: string): Promise<AdminEventRecord | null> {
    const events = await getDatasourceBundle().events.getAllEvents();
    return events.find((event) => event.id === id) ?? null;
  }

  async save(
    record: AdminEventRecord,
    context: AdminEventSaveContext = { source: 'cms' },
  ): Promise<AdminEventRecord> {
    const existing = record.id ? await this.getById(record.id) : null;

    if (context.source === 'moderation') {
      const fresh = existing ?? (await this.getById(record.id));
      if (!fresh || fresh.status !== 'review') {
        throw new AppError('Event is no longer in review. Refresh and try again.', {
          code: 'VALIDATION',
        });
      }

      if (!canAdminModerateTransition(fresh.status, record.status)) {
        throw new AppError('Event cannot be moderated from its current status.', {
          code: 'VALIDATION',
        });
      }
    } else if (existing && isContributorReviewEvent(existing)) {
      throw new AppError(
        'Contributor submissions in review must be moderated through the review workflow.',
        { code: 'VALIDATION' },
      );
    } else if (existing && record.status !== existing.status) {
      try {
        assertValidAdminEditorialTransition(existing.status, record.status);
      } catch (cause) {
        throw new AppError(cause instanceof Error ? cause.message : 'Invalid status transition.', {
          code: 'VALIDATION',
        });
      }
    }

    return getDatasourceBundle().events.saveEvent(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (existing && isContributorReviewEvent(existing)) {
      throw new AppError(
        'Contributor submissions in review cannot be deleted or archived outside moderation.',
        { code: 'VALIDATION' },
      );
    }

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

  getById(id: string): Promise<VenueRecord | null> {
    return getDatasourceBundle().venues.getById(id);
  }

  getBySlug(slug: string): Promise<VenueRecord | null> {
    return getDatasourceBundle().venues.getBySlug(slug);
  }
}

export class AdminVenueRepository {
  list(params: VenueListParams): Promise<PaginatedResult<VenueRecord>> {
    return getDatasourceBundle().venues.list(params);
  }

  getById(id: string): Promise<VenueRecord | null> {
    return getDatasourceBundle().venues.getById(id);
  }

  getBySlug(slug: string): Promise<VenueRecord | null> {
    return getDatasourceBundle().venues.getBySlug(slug);
  }

  getAll(): Promise<VenueRecord[]> {
    return getDatasourceBundle().venues.getAll();
  }

  save(record: VenueRecord): Promise<VenueRecord> {
    return getDatasourceBundle().venues.save(record);
  }

  delete(id: string): Promise<void> {
    return getDatasourceBundle().venues.delete(id);
  }

  countEventsForVenue(venueId: string): Promise<number> {
    return getDatasourceBundle().venues.countEventsForVenue(venueId);
  }

  listEventIdsForVenue(venueId: string): Promise<string[]> {
    return getDatasourceBundle().venues.listEventIdsForVenue(venueId);
  }
}

export class OrganizerRepository {
  getAll(): Promise<OrganizerRecord[]> {
    return getDatasourceBundle().organizers.getAll();
  }

  getById(id: string): Promise<OrganizerRecord | null> {
    return getDatasourceBundle().organizers.getById(id);
  }

  getBySlug(slug: string): Promise<OrganizerRecord | null> {
    return getDatasourceBundle().organizers.getBySlug(slug);
  }
}

export class AdminOrganizerRepository {
  list(params: OrganizerListParams): Promise<PaginatedResult<OrganizerRecord>> {
    return getDatasourceBundle().organizers.list(params);
  }

  getById(id: string): Promise<OrganizerRecord | null> {
    return getDatasourceBundle().organizers.getById(id);
  }

  getBySlug(slug: string): Promise<OrganizerRecord | null> {
    return getDatasourceBundle().organizers.getBySlug(slug);
  }

  getAll(): Promise<OrganizerRecord[]> {
    return getDatasourceBundle().organizers.getAll();
  }

  save(record: OrganizerRecord): Promise<OrganizerRecord> {
    return getDatasourceBundle().organizers.save(record);
  }

  delete(id: string): Promise<void> {
    return getDatasourceBundle().organizers.delete(id);
  }

  countEventsForOrganizer(organizerId: string): Promise<number> {
    return getDatasourceBundle().organizers.countEventsForOrganizer(organizerId);
  }

  listEventIdsForOrganizer(organizerId: string): Promise<string[]> {
    return getDatasourceBundle().organizers.listEventIdsForOrganizer(organizerId);
  }
}

export class ArtistRepository {
  getPublished(): Promise<ArtistRecord[]> {
    return getDatasourceBundle().artists.getPublished();
  }

  getPublishedById(id: string): Promise<ArtistRecord | null> {
    return getDatasourceBundle().artists.getPublishedById(id);
  }

  getPublishedBySlug(slug: string): Promise<ArtistRecord | null> {
    return getDatasourceBundle().artists.getPublishedBySlug(slug);
  }

  getAll(): Promise<ArtistRecord[]> {
    return getDatasourceBundle().artists.getAll();
  }

  countEventsForArtist(artistId: string): Promise<number> {
    return getDatasourceBundle().artists.countEventsForArtist(artistId);
  }

  listEventIdsForArtist(artistId: string): Promise<string[]> {
    return getDatasourceBundle().artists.listEventIdsForArtist(artistId);
  }
}

export class AdminArtistRepository {
  list(params: ArtistListParams): Promise<PaginatedResult<ArtistRecord>> {
    return getDatasourceBundle().artists.list(params);
  }

  getById(id: string): Promise<ArtistRecord | null> {
    return getDatasourceBundle().artists.getById(id);
  }

  getAll(): Promise<ArtistRecord[]> {
    return getDatasourceBundle().artists.getAll();
  }

  save(record: ArtistRecord): Promise<ArtistRecord> {
    return getDatasourceBundle().artists.save(record);
  }
}

export class EventLineupRepository {
  getLineupForEvent(eventId: string): Promise<EventLineupArtist[]> {
    return getDatasourceBundle().eventLineups.getLineupForEvent(eventId);
  }

  getLineupsForEvents(eventIds: string[]): Promise<Map<string, EventLineupArtist[]>> {
    return getDatasourceBundle().eventLineups.getLineupsForEvents(eventIds);
  }

  replaceEventLineup(eventId: string, lineup: EventLineupInput[]): Promise<EventLineupArtist[]> {
    return getDatasourceBundle().eventLineups.replaceEventLineup(eventId, lineup);
  }

  deleteLineupForEvent(eventId: string): Promise<void> {
    return getDatasourceBundle().eventLineups.deleteLineupForEvent(eventId);
  }
}

export class EventLineupEntryRepository {
  getEntriesForEvent(eventId: string): Promise<ResolvedCanonicalLineupEntry[]> {
    return getDatasourceBundle().eventLineupEntries.getEntriesForEvent(eventId);
  }

  getEntriesForEvents(eventIds: string[]): Promise<Map<string, ResolvedCanonicalLineupEntry[]>> {
    return getDatasourceBundle().eventLineupEntries.getEntriesForEvents(eventIds);
  }

  replaceEventLineupEntries(
    eventId: string,
    entries: ResolvedCanonicalLineupEntry[],
  ): Promise<ResolvedCanonicalLineupEntry[]> {
    return getDatasourceBundle().eventLineupEntries.replaceEventLineupEntries(eventId, entries);
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

export class AdminSourceRepository {
  list(params: SourceListParams): Promise<PaginatedResult<SourceRecord>> {
    return getDatasourceBundle().sources.list(params);
  }

  getById(id: string): Promise<SourceRecord | null> {
    return getDatasourceBundle().sources.getById(id);
  }

  getBySlug(slug: string): Promise<SourceRecord | null> {
    return getDatasourceBundle().sources.getBySlug(slug);
  }

  getAll(): Promise<SourceRecord[]> {
    return getDatasourceBundle().sources.getAll();
  }

  save(record: SourceRecord): Promise<SourceRecord> {
    return getDatasourceBundle().sources.save(record);
  }

  archive(id: string): Promise<SourceRecord | null> {
    return getDatasourceBundle().sources.archive(id);
  }

  restore(id: string): Promise<SourceRecord | null> {
    return getDatasourceBundle().sources.restore(id);
  }

  countImportJobsForSource(sourceId: string): Promise<number> {
    return getDatasourceBundle().sources.countImportJobsForSource(sourceId);
  }
}

export class SourceRepository {
  getAll(): Promise<SourceRecord[]> {
    return getDatasourceBundle().sources.getAll();
  }

  getActive(): Promise<SourceRecord[]> {
    return getDatasourceBundle().sources.getActive();
  }

  getById(id: string): Promise<SourceRecord | null> {
    return getDatasourceBundle().sources.getById(id);
  }

  getBySlug(slug: string): Promise<SourceRecord | null> {
    return getDatasourceBundle().sources.getBySlug(slug);
  }

  save(source: SourceRecord): Promise<SourceRecord> {
    return getDatasourceBundle().sources.save(source);
  }
}

export class StatsRepository {
  getDashboardStats(): Promise<DashboardStats> {
    return getDatasourceBundle().stats.getDashboardStats();
  }
}
