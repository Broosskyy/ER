import type { Event } from '@/features/events/types/event';

import type {
  AdminEventListParams,
  AdminEventRecord,
  AdminEventStatus,
  ArtistRecord,
  ArtistListParams,
  CityRecord,
  CollectionRecord,
  DashboardStats,
  GenreRecord,
  PaginatedResult,
  SourceRecord,
  SourceListParams,
  VenueRecord,
  VenueListParams,
  OrganizerRecord,
  OrganizerListParams,
} from '../types/records';
import type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from './import-types';
import type {
  ImportAdminDatasource,
  ImportAuditLogDatasource,
} from './import-admin-types';

export type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from './import-types';

export interface ContributorEventListParams {
  status?: AdminEventStatus;
}

export interface EventDatasource {
  getPublishedEvents(): Promise<Event[]>;
  getEventById(id: string): Promise<Event | null>;
  getAllEvents(): Promise<AdminEventRecord[]>;
  listEvents(params: AdminEventListParams): Promise<PaginatedResult<AdminEventRecord>>;
  listEventsByCreatedBy(
    userId: string,
    params?: ContributorEventListParams,
  ): Promise<AdminEventRecord[]>;
  getContributorEventById(eventId: string, userId: string): Promise<AdminEventRecord | null>;
  saveEvent(event: AdminEventRecord): Promise<AdminEventRecord>;
  deleteEvent(id: string): Promise<void>;
  deleteContributorDraft(eventId: string, userId: string): Promise<void>;
}

export interface GenreDatasource {
  getAll(): Promise<GenreRecord[]>;
  getActive(): Promise<GenreRecord[]>;
  save(genre: GenreRecord): Promise<GenreRecord>;
}

export interface CityDatasource {
  getAll(): Promise<CityRecord[]>;
  getActive(): Promise<CityRecord[]>;
  save(city: CityRecord): Promise<CityRecord>;
}

export interface VenueDatasource {
  getAll(): Promise<VenueRecord[]>;
  getById(id: string): Promise<VenueRecord | null>;
  getBySlug(slug: string): Promise<VenueRecord | null>;
  list(params: VenueListParams): Promise<PaginatedResult<VenueRecord>>;
  save(venue: VenueRecord): Promise<VenueRecord>;
  delete(id: string): Promise<void>;
  countEventsForVenue(venueId: string): Promise<number>;
  listEventIdsForVenue(venueId: string): Promise<string[]>;
}

export interface OrganizerDatasource {
  getAll(): Promise<OrganizerRecord[]>;
  getById(id: string): Promise<OrganizerRecord | null>;
  getBySlug(slug: string): Promise<OrganizerRecord | null>;
  list(params: OrganizerListParams): Promise<PaginatedResult<OrganizerRecord>>;
  save(organizer: OrganizerRecord): Promise<OrganizerRecord>;
  delete(id: string): Promise<void>;
  countEventsForOrganizer(organizerId: string): Promise<number>;
  listEventIdsForOrganizer(organizerId: string): Promise<string[]>;
}

export interface ArtistDatasource {
  getAll(): Promise<ArtistRecord[]>;
  getPublished(): Promise<ArtistRecord[]>;
  getById(id: string): Promise<ArtistRecord | null>;
  getPublishedById(id: string): Promise<ArtistRecord | null>;
  getBySlug(slug: string): Promise<ArtistRecord | null>;
  getPublishedBySlug(slug: string): Promise<ArtistRecord | null>;
  list(params: ArtistListParams): Promise<PaginatedResult<ArtistRecord>>;
  save(artist: ArtistRecord): Promise<ArtistRecord>;
}

export interface CollectionDatasource {
  getAll(): Promise<CollectionRecord[]>;
  getActive(): Promise<CollectionRecord[]>;
  save(collection: CollectionRecord): Promise<CollectionRecord>;
}

export interface SourceDatasource {
  getAll(): Promise<SourceRecord[]>;
  getActive(): Promise<SourceRecord[]>;
  getById(id: string): Promise<SourceRecord | null>;
  getBySlug(slug: string): Promise<SourceRecord | null>;
  list(params: SourceListParams): Promise<PaginatedResult<SourceRecord>>;
  save(source: SourceRecord): Promise<SourceRecord>;
  archive(id: string): Promise<SourceRecord | null>;
  restore(id: string): Promise<SourceRecord | null>;
  countImportJobsForSource(sourceId: string): Promise<number>;
}

export interface StatsDatasource {
  getDashboardStats(): Promise<DashboardStats>;
}

import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { EventLineupArtist } from '@/features/events/domain/event-lineup';

export interface EventLineupDatasource {
  getLineupForEvent(eventId: string): Promise<EventLineupArtist[]>;
  getLineupsForEvents(eventIds: string[]): Promise<Map<string, EventLineupArtist[]>>;
  replaceEventLineup(eventId: string, lineup: EventLineupInput[]): Promise<EventLineupArtist[]>;
  deleteLineupForEvent(eventId: string): Promise<void>;
}

export interface DatasourceBundle {
  events: EventDatasource;
  genres: GenreDatasource;
  cities: CityDatasource;
  venues: VenueDatasource;
  organizers: OrganizerDatasource;
  artists: ArtistDatasource;
  eventLineups: EventLineupDatasource;
  collections: CollectionDatasource;
  sources: SourceDatasource;
  stats: StatsDatasource;
  importSources: ImportSourceDatasource;
  importJobs: ImportJobDatasource;
  importRecords: ImportRecordDatasource;
  importLogs: ImportLogDatasource;
  importAuditLogs: ImportAuditLogDatasource;
  importAdmin: ImportAdminDatasource;
}
