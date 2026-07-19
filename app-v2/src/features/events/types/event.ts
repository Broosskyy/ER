import type { EventStatus } from './event-status';

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
  organizer?: string;
  ageRestriction?: string;
  priceText?: string;
  ticketUrl?: string;
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
