import type { Event } from '@/features/events/types/event';

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
} from '../types/records';
import type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from './import-types';

export type {
  ImportJobDatasource,
  ImportLogDatasource,
  ImportRecordDatasource,
  ImportSourceDatasource,
} from './import-types';

export interface EventDatasource {
  getPublishedEvents(): Promise<Event[]>;
  getEventById(id: string): Promise<Event | null>;
  getAllEvents(): Promise<AdminEventRecord[]>;
  listEvents(params: AdminEventListParams): Promise<PaginatedResult<AdminEventRecord>>;
  saveEvent(event: AdminEventRecord): Promise<AdminEventRecord>;
  deleteEvent(id: string): Promise<void>;
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
  save(venue: VenueRecord): Promise<VenueRecord>;
}

export interface ArtistDatasource {
  getAll(): Promise<ArtistRecord[]>;
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
  save(source: SourceRecord): Promise<SourceRecord>;
}

export interface StatsDatasource {
  getDashboardStats(): Promise<DashboardStats>;
}

export interface DatasourceBundle {
  events: EventDatasource;
  genres: GenreDatasource;
  cities: CityDatasource;
  venues: VenueDatasource;
  artists: ArtistDatasource;
  collections: CollectionDatasource;
  sources: SourceDatasource;
  stats: StatsDatasource;
  importSources: ImportSourceDatasource;
  importJobs: ImportJobDatasource;
  importRecords: ImportRecordDatasource;
  importLogs: ImportLogDatasource;
}
