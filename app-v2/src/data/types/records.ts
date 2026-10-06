export interface VenueRecord {
  id: string;
  slug: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizerRecord {
  id: string;
  slug: string;
  name: string;
  city?: string;
  country?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtistRecord {
  id: string;
  slug: string;
  name: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenreRecord {
  id: string;
  slug: string;
  name: string;
}

export interface CityRecord {
  id: string;
  slug: string;
  name: string;
}

export interface CollectionRecord {
  id: string;
  slug: string;
  name: string;
}

export interface SourceRecord {
  id: string;
  slug: string;
  name: string;
}

export interface AdminEventRecord {
  id: string;
  title: string;
  status: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface DashboardStats {
  publishedEvents: number;
}

export interface AdminEventListParams {
  status?: string;
}

export interface ArtistListParams {
  query?: string;
}

export interface VenueListParams {
  query?: string;
}

export interface OrganizerListParams {
  query?: string;
}

export interface SourceListParams {
  query?: string;
}
