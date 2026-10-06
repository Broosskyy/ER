import { ImageSourcePropType } from 'react-native';

import type { Event } from '../types/event';
import {
  EVENT_REFERENCE_DATE,
  formatDateLabel,
  formatEventTimeRange,
  hasKnownEventClockTime,
  isUpcomingEvent,
} from './date-time';
import { resolveConsumerOfficialSource } from '../sources/consumer-official-source';

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
  country: string;
  address?: string;
  genres: string[];
  artists: string[];
  lineup?: string[];
  organizer?: string;
  ageRestriction?: string;
  priceText?: string;
  ticketUrl?: string;
  eventSourceUrl?: string;
  officialEventUrl?: string;
  organizerSocialUrl?: string;
  venueSocialUrl?: string;
  organizerWebsiteUrl?: string;
  sourceImageUrl?: string;
  source: string;
  sourceLabel: string;
  sourceUrl?: string;
  visibleSources?: Array<{ role: 'official_event' | 'official_social_post'; label: string; url: string }>;
  organizerLinks?: Array<{
    role: 'organizer_website' | 'organizer_social' | 'venue_website' | 'venue_social';
    label: string;
    url: string;
  }>;
  officialSourceMissing?: boolean;
  startsAt: string;
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  status: Event['status'];
  lifecycleStatus?: Event['status'];
  venueId?: string;
  organizerId?: string;
  artistIds?: string[];
  galleryImageUrls?: string[];
  ticketProviderLabel?: string;
  ticketStatus?: Event['ticketStatus'];
  ticketBadgeStatus?: import('@/components/discovery/view-models').EventTicketStatus;
  cancelledAt?: string;
  postponedAt?: string;
  venueLabel?: string;
  cityLabel?: string;
  locationLabelComma?: string;
}

export function toEventDisplayModel(event: Event): EventDisplayModel {
  const hasClock = hasKnownEventClockTime(event.startDateTime, event.timezone);
  const timeRange = formatEventTimeRange(event);
  const officialSource = resolveConsumerOfficialSource({
    officialUrl: event.websiteUrl,
    organizerName: event.organizer,
    eventTitle: event.title,
    startsAt: event.startDateTime,
    imageUrl: event.imageUrl,
    venueName: event.venue,
    ticket: event.ticketUrl
      ? {
          id: event.id,
          provider: event.ticketProviderLabel ?? null,
          ticketUrl: event.ticketUrl,
          priceFromMinor: null,
          currency: null,
          salesStatus: null,
          sortOrder: 0,
        }
      : null,
    purchaseTicketUrl: event.ticketUrl,
  });

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    image: event.imageUrl ? { uri: event.imageUrl } : ({ uri: '' } as ImageSourcePropType),
    date: formatDateLabel(event.startDateTime, event.timezone),
    startTime: hasClock ? timeRange.split(' – ')[0] ?? timeRange : 'Open',
    endTime: hasClock ? timeRange.split(' – ')[1] : undefined,
    venue: event.venue,
    city: event.city,
    country: event.country,
    address: event.address,
    genres: event.genres,
    artists: event.artists,
    lineup: event.lineup,
    organizer: event.organizer,
    ageRestriction: event.ageRestriction,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    eventSourceUrl: officialSource.eventSourceUrl,
    officialEventUrl: officialSource.officialEventUrl,
    organizerSocialUrl: officialSource.organizerSocialUrl,
    venueSocialUrl: officialSource.venueSocialUrl,
    organizerWebsiteUrl: officialSource.organizerWebsiteUrl,
    sourceImageUrl: officialSource.sourceImageUrl,
    source: event.source,
    sourceLabel: officialSource.sourceLabel || event.sourceLabel || event.source,
    sourceUrl: officialSource.eventSourceUrl ?? event.sourceUrl,
    visibleSources: officialSource.visibleLinks,
    organizerLinks: officialSource.organizerLinks,
    officialSourceMissing: officialSource.officialSourceMissing,
    startsAt: event.startDateTime,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    timezone: event.timezone,
    latitude: event.latitude,
    longitude: event.longitude,
    status: event.status,
    lifecycleStatus: event.lifecycleStatus ?? event.status,
    venueId: event.venueId,
    organizerId: event.organizerId,
    artistIds: event.artistIds,
    galleryImageUrls: event.galleryImageUrls,
    ticketProviderLabel: event.ticketProviderLabel,
    ticketStatus: event.ticketStatus,
    cancelledAt: event.cancelledAt,
    postponedAt: event.postponedAt,
    venueLabel: event.venue,
    cityLabel: event.city,
    locationLabelComma: `${event.venue}, ${event.city}`,
  };
}

export function isDiscoverableDisplayEvent(
  event: Event,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  return isUpcomingEvent(event, referenceDate) && event.status === 'published';
}
