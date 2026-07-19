/** Admin / database event lifecycle statuses */
export const ADMIN_EVENT_STATUSES = [
  'draft',
  'review',
  'published',
  'archived',
  'deleted',
] as const;

export type AdminEventStatus = (typeof ADMIN_EVENT_STATUSES)[number];

export interface GenreRecord {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  active: boolean;
  sortOrder: number;
}

export interface CityRecord {
  id: string;
  name: string;
  slug: string;
  country: string;
  active: boolean;
}

export interface VenueRecord {
  id: string;
  name: string;
  address?: string;
  cityId: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  instagram?: string;
}

export interface ArtistRecord {
  id: string;
  name: string;
  spotify?: string;
  instagram?: string;
  website?: string;
}

export interface CollectionRecord {
  id: string;
  title: string;
  slug: string;
  description?: string;
  cover?: string;
  active: boolean;
  sortOrder: number;
}

export interface SourceRecord {
  id: string;
  name: string;
  type: string;
  website?: string;
  sourceUrl?: string;
  sourceConfig?: import('@/features/import/models/source-config').ImportSourceConfig;
  defaultTimezone?: string;
  trustScore: number;
  active: boolean;
  adapterKey?: string;
  reviewRequired?: boolean;
  lastImportAt?: string;
  lastJobStatus?: import('@/features/import/models/statuses').ImportJobStatus;
  nextScheduledAt?: string;
}

export interface AdminEventRecord {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  genreId?: string;
  venueId?: string;
  cityId?: string;
  artistId?: string;
  sourceId?: string;
  collectionId?: string;
  startDate: string;
  endDate?: string;
  ticketUrl?: string;
  imageUrl?: string;
  status: AdminEventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEventListParams {
  query?: string;
  status?: AdminEventStatus | 'all';
  sortBy?: 'date' | 'title' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardStats {
  events: number;
  cities: number;
  genres: number;
  venues: number;
  collections: number;
}
