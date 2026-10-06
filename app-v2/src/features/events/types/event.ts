import type { EventStatus } from './event-status';

export type VenueType = 'club' | 'open_air' | 'festival' | 'warehouse' | 'other';

export interface EventLineupEntryProjection {
  id: string;
  billingName: string;
  billingRole?: string;
  sortOrder?: number;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl?: string;
  imageAssetKey?: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  venue: string;
  address?: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  genres: string[];
  artists: string[];
  lineup?: string[];
  lineupEntries?: EventLineupEntryProjection[];
  organizer?: string;
  venueId?: string;
  organizerId?: string;
  artistIds?: string[];
  genreIds?: string[];
  doorsOpenAt?: string;
  salesStartAt?: string;
  salesEndAt?: string;
  websiteUrl?: string;
  cancelledAt?: string;
  postponedAt?: string;
  publishedAt?: string;
  ticketStatus?: 'not_configured' | 'external_link' | 'on_sale' | 'sold_out' | 'sales_ended';
  canonicalEventId?: string;
  festivalEditionId?: string;
  festivalId?: string;
  venueType?: VenueType;
  lifecycleHints?: Array<'venue_changed' | 'time_changed' | 'date_changed'>;
  previousVenue?: string;
  previousStartDateTime?: string;
  venueChangedAt?: string;
  ageRestriction?: string;
  priceText?: string;
  ticketUrl?: string;
  flyerUrl?: string;
  lastEntryAt?: string;
  dressCode?: string;
  accessibilityNotes?: string;
  source: string;
  sourceEventId: string;
  sourceUrl?: string;
  status: EventStatus;
  lifecycleStatus?: EventStatus;
  createdAt: string;
  updatedAt: string;
  galleryImageUrls?: string[];
  ticketProviderLabel?: string;
  sourceLabel?: string;
}

export interface EventWithCoordinates extends Event {
  latitude: number;
  longitude: number;
}
