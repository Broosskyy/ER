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
  slug: string;
  name: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  capacity?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /** @deprecated Legacy combined address; use street/houseNumber. */
  address?: string;
  /** @deprecated Legacy cities FK; canonical city is `city`. */
  cityId?: string;
  /** @deprecated Social link retained for compatibility. */
  instagram?: string;
}

export interface VenueListParams {
  query?: string;
  city?: string;
  country?: string;
  sortBy?: 'name' | 'updated' | 'city';
  page?: number;
  pageSize?: number;
}

export interface OrganizerRecord {
  id: string;
  slug: string;
  name: string;
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  residentAdvisor?: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizerListParams {
  query?: string;
  city?: string;
  country?: string;
  sortBy?: 'name' | 'updated' | 'city';
  page?: number;
  pageSize?: number;
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

export interface SourceListParams {
  query?: string;
  sourceType?: import('@/features/sources/domain/source-types').SourceType;
  parserType?: import('@/features/sources/domain/source-types').ParserType;
  acquisitionStrategy?: import('@/features/sources/domain/source-types').AcquisitionStrategy;
  enabled?: boolean;
  archived?: boolean;
  requiresAuthentication?: boolean;
  minTrustScore?: number;
  maxTrustScore?: number;
  minPriority?: number;
  maxPriority?: number;
  sortBy?: 'priority' | 'displayName' | 'trustScore' | 'sourceType' | 'created' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface SourceRecord {
  id: string;
  slug: string;
  displayName: string;
  description?: string;
  sourceType: import('@/features/sources/domain/source-types').SourceType;
  baseUrl?: string;
  parserType: import('@/features/sources/domain/source-types').ParserType;
  acquisitionStrategy: import('@/features/sources/domain/source-types').AcquisitionStrategy;
  pollingStrategy?: import('@/features/sources/domain/source-types').PollingStrategy;
  pollingIntervalMinutes?: number;
  rateLimitPerHour?: number;
  priority: number;
  trustScore: number;
  requiresAuthentication: boolean;
  enabled: boolean;
  archived: boolean;
  notes?: string;
  sourceConfig?: import('@/features/import/models/source-config').ImportSourceConfig;
  defaultTimezone?: string;
  reviewRequired?: boolean;
  website?: string;
  lastImportAt?: string;
  lastJobStatus?: import('@/features/import/models/statuses').ImportJobStatus;
  nextScheduledAt?: string;
  createdAt: string;
  updatedAt: string;
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
  organizerId?: string;
  /** @deprecated Legacy free-text organizer; canonical source is `organizerId`. */
  organizerName?: string;
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
  organizers: number;
  collections: number;
}
