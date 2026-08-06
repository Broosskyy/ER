import { ImageSourcePropType } from 'react-native';

import { getSourceDisplayLabel, resolveEventImageSource } from '../data/demo-images';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  collectSearchableAttributeTerms,
  projectEventAttributeBadges,
} from '@/features/events/domain/event-attribute-badge-projection';
import type {
  CanonicalEventProjection,
  PosterMetadataSlot,
} from '@/features/events/formatting/canonical-event-projection';
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
  hasKnownEventClockTime,
  isThisMonthEvent,
  isThisWeekEvent,
  isUpcomingEvent,
  normalizeIanaTimezone,
} from '../formatting/date-time';
import type { VenueType } from '../domain/festival-foundation';
import type {
  CanonicalEventAttribute,
  EventAttributeBadge,
  VenueEnvironmentValue,
} from '@/features/events/domain/canonical-event-attribute-types';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import { resolveConsumerTicketPhaseAvailability } from '@/features/events/formatting/ticket-phase-consumer-bridge';
import type { TicketAvailabilityState } from '@/features/events/domain/canonical-ticket-domain';
import type { AdminEventTicketStatus } from '@/features/import/domain/canonical-ticket-phase';
import type { Event, EventWithCoordinates } from '../types/event';

import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';

export interface EventDisplayModel extends CanonicalEventProjection {
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
  officialEventUrl?: string;
  ticketDestinationClass?: import('@/features/events/domain/canonical-ticket-domain').TicketDestinationClass;
  ticketCtaLabel?: string;
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
  publishedAt?: string;
  createdAt?: string;
  /** Canonical projection — single source of truth for all public surfaces. */
  sanitizedDescription?: string;
  displayPriceText?: string;
  ticketProviderLabel: string;
  venueLabel: string;
  cityLabel: string;
  locationLabelComma: string;
  locationLabelDot: string;
  knownArtistNames: string[];
  lineupCompleteness: 'full' | 'partial' | 'none';
  lineupSectionTitle: string;
  hasKnownLineup: boolean;
  posterMetadata?: PosterMetadataSlot;
  ticketPhases?: CanonicalTicketPhase[];
  eventAttributes?: CanonicalEventAttribute[];
  floorCount?: number;
  stageCount?: number;
  venueEnvironment?: VenueEnvironmentValue;
  attributeBadges?: EventAttributeBadge[];
  searchableAttributeTerms?: string[];
  canonicalAvailability?: TicketAvailabilityState;
  canonicalTicketStatus?: AdminEventTicketStatus;
  minimumPrice?: number;
  maximumPrice?: number;
  salesStartAt?: string;
  salesEndAt?: string;
}

export function toEventDisplayModel(event: Event): EventDisplayModel {
  const canonicalTicket = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    sourceUrl: event.sourceUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
  });

  const canonical = projectCanonicalEventFields({
    title: event.title,
    description: event.description,
    venue: event.venue,
    city: event.city,
    artists: event.artists,
    lineup: event.lineup,
    priceText: canonicalTicket.priceText ?? event.priceText,
    source: event.source,
    ticketUrl: canonicalTicket.publicCtaUrl ?? event.ticketUrl,
    ticketPlatform: canonicalTicket.ticketPlatform,
    ticketDestinationClass: canonicalTicket.destinationClass,
    ticketStatus: canonicalTicket.ticketStatus ?? event.ticketStatus,
    ticketPhases: resolveConsumerTicketPhaseAvailability(event),
    countryLabel: event.country,
    latitude: event.latitude,
    longitude: event.longitude,
    timezone: event.timezone,
    organizer: event.organizer,
    imageUrl: event.imageUrl,
    imageUrls: buildConsumerGalleryImageUrls({
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
    }),
    genres: event.genres,
    lineupEntries: event.lineupEntries,
    posterMetadata: readPosterMetadataSlot(event),
  });

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    image: resolveEventImageSource(event),
    date: formatDateLabel(event.startDateTime, event.timezone),
    startTime: hasKnownEventClockTime(event.startDateTime, event.timezone)
      ? formatTimeInTimezone(event.startDateTime, event.timezone)
      : '',
    endTime:
      event.endDateTime && hasKnownEventClockTime(event.endDateTime, event.timezone)
        ? formatTimeInTimezone(event.endDateTime, event.timezone)
        : undefined,
    venue: canonical.venueLabel,
    city: canonical.cityLabel,
    country: event.country,
    address: event.address,
    genres: event.genres,
    artists: canonical.knownArtistNames,
    lineup: canonical.knownArtistNames,
    organizer: event.organizer,
    ageRestriction: event.ageRestriction,
    priceText: canonical.displayPriceText,
    ticketUrl: canonicalTicket.publicCtaUrl ?? event.ticketUrl,
    officialEventUrl: canonicalTicket.officialEventUrl,
    ticketDestinationClass: canonicalTicket.destinationClass,
    ticketCtaLabel: canonicalTicket.ctaLabel,
    source: event.source,
    sourceLabel: canonical.ticketProviderLabel,
    sourceUrl: event.sourceUrl,
    startsAt: event.startDateTime,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    timezone: normalizeIanaTimezone(event.timezone),
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
    publishedAt: event.publishedAt,
    createdAt: event.createdAt,
    sanitizedDescription: canonical.sanitizedDescription,
    displayPriceText: canonical.displayPriceText,
    ticketProviderLabel: canonical.ticketProviderLabel,
    venueLabel: canonical.venueLabel,
    cityLabel: canonical.cityLabel,
    locationLabelComma: canonical.locationLabelComma,
    locationLabelDot: canonical.locationLabelDot,
    knownArtistNames: canonical.knownArtistNames,
    lineupEntries: canonical.lineupEntries,
    lineupCompleteness: canonical.lineupCompleteness,
    lineupSectionTitle: canonical.lineupSectionTitle,
    hasKnownLineup: canonical.hasKnownLineup,
    posterMetadata: canonical.posterMetadata,
    ticketPhases: event.ticketPhases,
    shortDescription: canonical.shortDescription,
    ticketAvailability: canonical.ticketAvailability,
    isSoldOut: canonical.isSoldOut,
    countryCode: canonical.countryCode,
    countryLabel: canonical.countryLabel,
    hasCoordinates: canonical.hasCoordinates,
    organizerLabel: canonical.organizerLabel,
    promoterLabel: canonical.promoterLabel,
    heroImageUrl: canonical.heroImageUrl,
    galleryImageUrls: canonical.galleryImageUrls,
    qualityState: canonical.qualityState,
    originCount: canonical.originCount,
    sourceAttributionLabel: canonical.sourceAttributionLabel,
    eventAttributes: event.eventAttributes,
    floorCount: event.floorCount,
    stageCount: event.stageCount,
    venueEnvironment: event.venueEnvironment,
    attributeBadges: projectEventAttributeBadges(event.eventAttributes, {
      floorCount: event.floorCount,
      stageCount: event.stageCount,
    }),
    searchableAttributeTerms: collectSearchableAttributeTerms(event.eventAttributes, {
      floorCount: event.floorCount,
    }),
    canonicalAvailability: canonicalTicket.availability,
    canonicalTicketStatus: canonicalTicket.ticketStatus,
    minimumPrice: canonicalTicket.minimumPrice,
    maximumPrice: canonicalTicket.maximumPrice,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
  };
}

function readPosterMetadataSlot(event: Event): PosterMetadataSlot | undefined {
  const metadata = (event as Event & { sourceMetadata?: Record<string, unknown> }).sourceMetadata;
  const poster = metadata?.posterMetadata as PosterMetadataSlot | undefined;
  return poster?.status === 'available' ? poster : undefined;
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
