import type { EventStatus } from './event-status';
import type { VenueType } from '@/features/events/domain/festival-foundation';

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
  lineupEntries?: import('@/features/events/domain/event-lineup-entry-projection').EventLineupEntryProjection[];
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
  ticketPhases?: import('@/features/import/domain/canonical-ticket-phase').CanonicalTicketPhase[];
  eventAttributes?: import('@/features/events/domain/canonical-event-attribute-types').CanonicalEventAttribute[];
  floorCount?: number;
  stageCount?: number;
  venueEnvironment?: import('@/features/events/domain/canonical-event-attribute-types').VenueEnvironmentValue;
  flyerUrl?: string;
  lastEntryAt?: string;
  dressCode?: string;
  accessibilityNotes?: string;
  source: string;
  sourceEventId: string;
  sourceUrl?: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventWithCoordinates extends Event {
  latitude: number;
  longitude: number;
}
