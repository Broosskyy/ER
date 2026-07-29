export const FESTIVAL_STATUSES = ['active', 'archived'] as const;
export type FestivalStatus = (typeof FESTIVAL_STATUSES)[number];

export const FESTIVAL_EDITION_STATUSES = [
  'planned',
  'announced',
  'on_sale',
  'ongoing',
  'completed',
  'cancelled',
  'archived',
] as const;
export type FestivalEditionStatus = (typeof FESTIVAL_EDITION_STATUSES)[number];

export const VENUE_TYPES = [
  'club',
  'open_air',
  'festival_ground',
  'warehouse',
  'hybrid',
  'temporary',
  'unknown',
] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export interface FestivalRecord {
  id: string;
  slug: string;
  name: string;
  description?: string;
  organizerId?: string;
  seriesKey?: string;
  website?: string;
  logoUrl?: string;
  status: FestivalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FestivalEditionRecord {
  id: string;
  festivalId: string;
  slug: string;
  name: string;
  year?: number;
  editionLabel?: string;
  startDate?: string;
  endDate?: string;
  venueId?: string;
  city?: string;
  country?: string;
  status: FestivalEditionStatus;
  campingEnabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
