import { ImageSourcePropType } from 'react-native';

import { getEventImageAsset, getSourceDisplayLabel } from '../data/demo-images';
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
}

export function toEventDisplayModel(event: Event): EventDisplayModel {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    image: getEventImageAsset(event.id, event.imageAssetKey),
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
  };
}

export function hasMapCoordinates(
  event: Event | EventDisplayModel,
): event is EventWithCoordinates | (EventDisplayModel & { latitude: number; longitude: number }) {
  return hasValidCoordinates(event.latitude, event.longitude);
}

export { formatEventDateTime, formatEventTimeRange, EVENT_REFERENCE_DATE };
export { isUpcomingEvent, isThisWeekEvent, isThisMonthEvent };
