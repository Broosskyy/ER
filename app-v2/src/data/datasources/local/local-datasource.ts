import type { Event } from '@/features/events/types/event';
import type { EventStatus } from '@/features/events/types/event-status';
import { runDefaultEventPipeline } from '@/features/events/pipeline/run-pipeline';
import { filterConfig } from '@/features/search/config/filter-config';

import type {
  AdminEventListParams,
  AdminEventRecord,
  AdminEventStatus,
  ArtistRecord,
  CityRecord,
  CollectionRecord,
  DashboardStats,
  GenreRecord,
  PaginatedResult,
  SourceRecord,
  VenueRecord,
} from '@/data/types/records';
import type {
  ContributorEventListParams,
  ArtistDatasource,
  CityDatasource,
  CollectionDatasource,
  EventDatasource,
  GenreDatasource,
  SourceDatasource,
  StatsDatasource,
  VenueDatasource,
} from '@/data/datasources/types';
import {
  createLocalImportDatasourceBundle,
  createLocalImportSourceDatasource,
  type LocalImportStore,
} from '@/data/datasources/local/local-import-datasource';
import {
  loadPersistedContributorEvents,
  savePersistedContributorEvents,
} from '@/data/datasources/local/local-contributor-event-storage';
import { mapSourceRecordToImportSource } from '@/data/mappers/import-mapper';

function mapPipelineStatusToAdmin(status: EventStatus): AdminEventStatus {
  return status;
}

function mapAdminStatusToPipeline(status: AdminEventStatus): EventStatus {
  return status;
}

function eventToAdminRecord(event: Event): AdminEventRecord {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    genreId: filterConfig.genreOptions.find((g) =>
      event.genres.some((genre) => genre.toLowerCase() === g.label.toLowerCase()),
    )?.id,
    cityId: filterConfig.cityOptions.find((c) => c.value === event.city)?.id,
    startDate: event.startDateTime,
    endDate: event.endDateTime,
    ticketUrl: event.ticketUrl,
    imageUrl: event.imageUrl,
    status: mapPipelineStatusToAdmin(event.status),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function adminRecordToEvent(record: AdminEventRecord, existing?: Event): Event {
  const genre = filterConfig.genreOptions.find((g) => g.id === record.genreId);
  const city = filterConfig.cityOptions.find((c) => c.id === record.cityId);

  return {
    id: record.id,
    slug: existing?.slug ?? record.id,
    title: record.title,
    description: record.description,
    imageUrl: record.imageUrl ?? existing?.imageUrl,
    imageAssetKey: existing?.imageAssetKey,
    startDateTime: record.startDate,
    endDateTime: record.endDate,
    timezone: existing?.timezone ?? 'Europe/Berlin',
    venue: existing?.venue ?? 'TBA',
    address: existing?.address,
    city: city?.value ?? existing?.city ?? 'Köln',
    country: existing?.country ?? 'Germany',
    latitude: existing?.latitude,
    longitude: existing?.longitude,
    genres: genre ? [genre.label] : existing?.genres ?? [],
    artists: existing?.artists ?? [],
    lineup: existing?.lineup,
    organizer: existing?.organizer,
    ageRestriction: existing?.ageRestriction,
    priceText: existing?.priceText,
    ticketUrl: record.ticketUrl,
    source: existing?.source ?? 'admin',
    sourceEventId: existing?.sourceEventId ?? record.id,
    sourceUrl: existing?.sourceUrl,
    status: mapAdminStatusToPipeline(record.status),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildLocalGenres(): GenreRecord[] {
  return filterConfig.genreOptions.map((genre) => ({
    id: genre.id,
    name: genre.label,
    slug: genre.value,
    icon: genre.icon,
    active: genre.active,
    sortOrder: genre.sortOrder,
  }));
}

function buildLocalCities(): CityRecord[] {
  return filterConfig.cityOptions.map((city) => ({
    id: city.id,
    name: city.label,
    slug: city.id,
    country: 'Germany',
    active: city.active,
  }));
}

function buildLocalCollections(): CollectionRecord[] {
  return [
    { id: 'highlights', title: 'Highlights', slug: 'highlights', active: true, sortOrder: 0 },
    { id: 'tonight', title: 'Tonight', slug: 'tonight', active: true, sortOrder: 1 },
    { id: 'weekend', title: 'This Weekend', slug: 'weekend', active: true, sortOrder: 2 },
    { id: 'upcoming', title: 'Upcoming', slug: 'upcoming', active: true, sortOrder: 3 },
  ];
}

function buildLocalSources(): SourceRecord[] {
  return [
    {
      id: 'demo',
      name: 'Demo Source',
      type: 'manual',
      trustScore: 1,
      active: true,
      adapterKey: 'demo',
    },
    {
      id: 'admin',
      name: 'Admin',
      type: 'manual',
      trustScore: 1,
      active: true,
      adapterKey: 'manual',
    },
  ];
}

function buildLocalVenues(events: Event[]): VenueRecord[] {
  const seen = new Map<string, VenueRecord>();
  for (const event of events) {
    if (!seen.has(event.venue)) {
      seen.set(event.venue, {
        id: `venue-${seen.size + 1}`,
        name: event.venue,
        address: event.address,
        cityId: filterConfig.defaultCityId,
        latitude: event.latitude,
        longitude: event.longitude,
      });
    }
  }
  return Array.from(seen.values());
}

function buildLocalArtists(events: Event[]): ArtistRecord[] {
  const seen = new Map<string, ArtistRecord>();
  for (const event of events) {
    for (const artist of event.artists) {
      if (!seen.has(artist)) {
        seen.set(artist, { id: `artist-${seen.size + 1}`, name: artist });
      }
    }
  }
  return Array.from(seen.values());
}

export class LocalStore {
  events: Event[];
  adminEvents: AdminEventRecord[];
  genres: GenreRecord[];
  cities: CityRecord[];
  venues: VenueRecord[];
  artists: ArtistRecord[];
  collections: CollectionRecord[];
  sources: SourceRecord[];

  constructor() {
    const report = runDefaultEventPipeline();
    this.events = report.publishedEvents;
    this.adminEvents = report.publishedEvents.map(eventToAdminRecord);
    this.genres = buildLocalGenres();
    this.cities = buildLocalCities();
    this.venues = buildLocalVenues(this.events);
    this.artists = buildLocalArtists(this.events);
    this.collections = buildLocalCollections();
    this.sources = buildLocalSources();
  }
}

let sharedLocalStore: LocalStore | undefined;
let contributorHydrationPromise: Promise<void> | undefined;

export function getLocalStore(): LocalStore {
  sharedLocalStore ??= new LocalStore();
  return sharedLocalStore;
}

export async function hydrateLocalContributorEvents(store = getLocalStore()): Promise<void> {
  const persisted = await loadPersistedContributorEvents();
  if (persisted.length === 0) {
    return;
  }

  const existingIds = new Set(store.adminEvents.map((event) => event.id));
  for (const record of persisted) {
    if (existingIds.has(record.id)) {
      const index = store.adminEvents.findIndex((event) => event.id === record.id);
      if (index >= 0) {
        store.adminEvents[index] = record;
      }
      continue;
    }

    store.adminEvents.push(record);
    const pipelineEvent = adminRecordToEvent(record);
    if (!store.events.some((event) => event.id === record.id)) {
      store.events.push(pipelineEvent);
    }
  }
}

export async function ensureLocalContributorEventsHydrated(store = getLocalStore()): Promise<void> {
  contributorHydrationPromise ??= hydrateLocalContributorEvents(store);
  await contributorHydrationPromise;
}

async function persistContributorEventsIfNeeded(store: LocalStore): Promise<void> {
  await savePersistedContributorEvents(store.adminEvents);
}

export function resetLocalContributorHydrationForTesting(): void {
  contributorHydrationPromise = undefined;
  sharedLocalStore = undefined;
}

function sortContributorEvents(items: AdminEventRecord[]): AdminEventRecord[] {
  return [...items].sort((left, right) => {
    const updatedCompare = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedCompare !== 0) {
      return updatedCompare;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function createLocalEventDatasource(store = getLocalStore()): EventDatasource {
  return {
    async getPublishedEvents() {
      return store.events.filter((event) => event.status === 'published');
    },
    async getEventById(id) {
      return store.events.find((event) => event.id === id) ?? null;
    },
    async getAllEvents() {
      return [...store.adminEvents];
    },
    async listEventsByCreatedBy(userId, params?: ContributorEventListParams) {
      await ensureLocalContributorEventsHydrated(store);
      let items = store.adminEvents.filter((event) => event.createdBy === userId);
      if (params?.status) {
        items = items.filter((event) => event.status === params.status);
      }
      return sortContributorEvents(items);
    },
    async getContributorEventById(eventId, userId) {
      await ensureLocalContributorEventsHydrated(store);
      const event = store.adminEvents.find(
        (entry) => entry.id === eventId && entry.createdBy === userId,
      );
      return event ?? null;
    },
    async listEvents(params) {
      let items = [...store.adminEvents];
      const query = params.query?.trim().toLowerCase();
      if (query) {
        items = items.filter(
          (event) =>
            event.title.toLowerCase().includes(query) ||
            event.description.toLowerCase().includes(query),
        );
      }
      if (params.status && params.status !== 'all') {
        items = items.filter((event) => event.status === params.status);
      }
      if (params.sortBy === 'title') {
        items.sort((a, b) => a.title.localeCompare(b.title));
      } else if (params.sortBy === 'updated') {
        items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } else {
        items.sort((a, b) => a.startDate.localeCompare(b.startDate));
      }
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        page,
        pageSize,
      } satisfies PaginatedResult<AdminEventRecord>;
    },
    async saveEvent(record) {
      await ensureLocalContributorEventsHydrated(store);
      const existing = store.events.find((event) => event.id === record.id);
      const mapped = adminRecordToEvent(record, existing);
      const adminRecord = { ...record, updatedAt: new Date().toISOString() };
      const eventIndex = store.events.findIndex((event) => event.id === record.id);
      const adminIndex = store.adminEvents.findIndex((event) => event.id === record.id);
      if (eventIndex >= 0) {
        store.events[eventIndex] = mapped;
      } else {
        store.events.push(mapped);
      }
      if (adminIndex >= 0) {
        store.adminEvents[adminIndex] = adminRecord;
      } else {
        store.adminEvents.push(adminRecord);
      }

      if (adminRecord.createdBy) {
        await persistContributorEventsIfNeeded(store);
      }
      return adminRecord;
    },
    async deleteEvent(id) {
      store.events = store.events.filter((event) => event.id !== id);
      store.adminEvents = store.adminEvents.map((event) =>
        event.id === id ? { ...event, status: 'archived', updatedAt: new Date().toISOString() } : event,
      );
      await persistContributorEventsIfNeeded(store);
    },
  };
}

function createCrudDatasource<T extends { id: string }>(
  getItems: () => T[],
  setItems: (items: T[]) => void,
) {
  return {
    async getAll() {
      return [...getItems()];
    },
    async getActive() {
      return [...getItems()].filter((item) => ('active' in item ? item.active : true));
    },
    async getById(id: string) {
      return getItems().find((item) => item.id === id) ?? null;
    },
    async save(item: T) {
      const items = getItems();
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        items[index] = item;
      } else {
        items.push(item);
      }
      setItems(items);
      return item;
    },
  };
}

export function createLocalDatasourceBundle(store = getLocalStore()) {
  const events = createLocalEventDatasource(store);
  const genres: GenreDatasource = createCrudDatasource(
    () => store.genres,
    (items) => {
      store.genres = items;
    },
  );
  const cities: CityDatasource = createCrudDatasource(
    () => store.cities,
    (items) => {
      store.cities = items;
    },
  );
  const venues: VenueDatasource = createCrudDatasource(
    () => store.venues,
    (items) => {
      store.venues = items;
    },
  );
  const artists: ArtistDatasource = createCrudDatasource(
    () => store.artists,
    (items) => {
      store.artists = items;
    },
  );
  const collections: CollectionDatasource = createCrudDatasource(
    () => store.collections,
    (items) => {
      store.collections = items;
    },
  );
  const sources: SourceDatasource = createCrudDatasource(
    () => store.sources,
    (items) => {
      store.sources = items;
    },
  );
  const stats: StatsDatasource = {
    async getDashboardStats(): Promise<DashboardStats> {
      return {
        events: store.adminEvents.filter((event) => event.status !== 'archived').length,
        cities: store.cities.filter((city) => city.active).length,
        genres: store.genres.filter((genre) => genre.active).length,
        venues: store.venues.length,
        collections: store.collections.filter((collection) => collection.active).length,
      };
    },
  };

  const importStore: LocalImportStore = {
    sources: store.sources.map(mapSourceRecordToImportSource),
    jobs: [],
    records: [],
    logs: [],
    auditLogs: [],
  };
  const importBundle = createLocalImportDatasourceBundle(importStore);
  const importSources = createLocalImportSourceDatasource(importStore);

  const syncImportSources = () => {
    importStore.sources = store.sources.map(mapSourceRecordToImportSource);
  };
  const originalSave = sources.save.bind(sources);
  sources.save = async (source) => {
    const saved = await originalSave(source);
    syncImportSources();
    return saved;
  };

  return {
    events,
    genres,
    cities,
    venues,
    artists,
    collections,
    sources,
    stats,
    importSources,
    importJobs: importBundle.importJobs,
    importRecords: importBundle.importRecords,
    importLogs: importBundle.importLogs,
    importAuditLogs: importBundle.importAuditLogs,
    importAdmin: importBundle.importAdmin,
  };
}
