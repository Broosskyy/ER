import { EVENT_STATUSES, type EventStatus } from '@/features/events/types/event-status';
import type {
  ArtistLifecycleStatus,
  ArtistVerificationStatus,
} from '@/features/artists/types/artist-status';

/** Admin / database event lifecycle statuses (aligned with domain `EventStatus`). */
export const ADMIN_EVENT_STATUSES = EVENT_STATUSES;

export type AdminEventStatus = EventStatus;

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
  slug: string;
  bio?: string;
  imageUrl?: string;
  genreIds: string[];
  country?: string;
  city?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  spotify?: string;
  status: ArtistLifecycleStatus;
  verificationStatus: ArtistVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ArtistListParams {
  query?: string;
  status?: ArtistLifecycleStatus | 'all';
  sortBy?: 'name' | 'updated';
  page?: number;
  pageSize?: number;
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
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  imageUrl?: string;
  flyerUrl?: string;
  /** Suggested venue name when no confirmed `venueId` exists. */
  venueName?: string;
  /** Optional city label for suggested venues. */
  venueCity?: string;
  status: AdminEventStatus;
  createdBy?: string;
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
  artists: number;
  collections: number;
}
