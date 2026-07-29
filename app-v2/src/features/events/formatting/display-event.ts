import { ImageSourcePropType } from 'react-native';

import { getSourceDisplayLabel, resolveEventImageSource } from '../data/demo-images';
import { eventLifecycleResolver } from '../lifecycle/event-lifecycle-resolver';
import { toEventLifecycleInput } from '../lifecycle/event-lifecycle-from-event';
import type { LifecycleStatus } from '../lifecycle/lifecycle-types';
import { hasValidCoordinates } from '../formatting/coordinates';
import {
  EVENT_REFERENCE_DATE,
  formatDateLabel,
  formatEventDateTime,
  formatEventTimeRange,
  formatTimeInTimezone,
  isThisMonthEvent,
  isThisWeekEvent,
  isUpcomingEvent,
} from '../formatting/date-time';
import type { VenueType } from '../domain/festival-foundation';
import type { Event, EventWithCoordinates } from '../types/event';

export interface EventDisplayModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
  date: string;
  startTime: string;
  endTime?: string;
  venue: string;
  city: string;
  address?: string;
  genres: string[];
  artists: string[];
  lineup?: string[];
  organizer?: string;
  ageRestriction?: string;
  priceText?: string;
  ticketUrl?: string;
  source: string;
  sourceLabel: string;
  sourceUrl?: string;
  startsAt: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  status: Event['status'];
  lifecycleStatus?: LifecycleStatus;
  venueId?: string;
  organizerId?: string;
  artistIds?: string[];
  festivalId?: string;
  festivalEditionId?: string;
  festivalLabel?: string;
  venueType?: VenueType;
  lifecycleNotices?: Array<'venue_changed' | 'time_changed' | 'date_changed'>;
  previousVenue?: string;
  previousStartDateTime?: string;
  updatedAt?: string;
}

export function toEventDisplayModel(event: Event): EventDisplayModel {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    image: resolveEventImageSource(event),
    date: formatDateLabel(event.startDateTime, event.timezone),
    startTime: formatTimeInTimezone(event.startDateTime, event.timezone),
    endTime: event.endDateTime
      ? formatTimeInTimezone(event.endDateTime, event.timezone)
      : undefined,
    venue: event.venue,
    city: event.city,
    address: event.address,
    genres: event.genres,
    artists: event.artists,
    lineup: event.lineup,
    organizer: event.organizer,
    ageRestriction: event.ageRestriction,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    source: event.source,
    sourceLabel: getSourceDisplayLabel(event.source),
    sourceUrl: event.sourceUrl,
    startsAt: event.startDateTime,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    timezone: event.timezone,
    latitude: event.latitude,
    longitude: event.longitude,
    status: event.status,
    lifecycleStatus: eventLifecycleResolver.resolve(toEventLifecycleInput(event)).status,
    venueId: event.venueId,
    organizerId: event.organizerId,
    artistIds: event.artistIds,
    festivalId: event.festivalId,
    festivalEditionId: event.festivalEditionId,
    festivalLabel: event.festivalId ? resolveFestivalLabel(event) : undefined,
    venueType: event.venueType,
    lifecycleNotices: event.lifecycleHints,
    previousVenue: event.previousVenue,
    previousStartDateTime: event.previousStartDateTime,
    updatedAt: event.updatedAt,
  };
}

function resolveFestivalLabel(event: Event): string | undefined {
  if (event.festivalEditionId) {
    return `Festival Edition`;
  }
  return 'Festival';
}

export function hasMapCoordinates(
  event: Event | EventDisplayModel,
): event is EventWithCoordinates | (EventDisplayModel & { latitude: number; longitude: number }) {
  return hasValidCoordinates(event.latitude, event.longitude);
}

export { formatEventDateTime, formatEventTimeRange, EVENT_REFERENCE_DATE };
export { isUpcomingEvent, isThisWeekEvent, isThisMonthEvent };
