import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';
import { normalizePublicEventDescription } from '@/features/events/formatting/public-description-normalizer';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { inferLineupCompleteness, resolveLineupSectionTitle } from '@/features/event-detail/utils/lineup-completeness';
import type { EventLineupEntryProjection } from '@/features/events/domain/event-lineup-entry-projection';
import { resolveKnownArtistNamesFromCanonical } from '@/features/events/domain/canonical-lineup-read';
import { resolveEventPriceAvailabilitySemantics } from '@/features/events/domain/event-price-availability-semantics';
import type { TicketPhaseAvailability } from '@/features/events/domain/event-price-availability-semantics';

import {
  hasValidEventCoordinates,
  meaningfulEventText,
} from '@/features/events/domain/event-field-value';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import {
  resolveTicketProviderPresentationLabel,
} from '@/features/events/formatting/ticket-platform-presentation';
import type { TicketDestinationClass } from '@/features/events/domain/canonical-ticket-domain';

/** Future OCR merge target — poster-derived hints stay separate from source metadata. */
export interface PosterMetadataSlot {
  source: 'poster_ocr' | 'poster_manual';
  status: 'pending' | 'available';
  artistNames?: string[];
  lineupHints?: string[];
  dateHints?: string[];
  stageHints?: string[];
  extractedAt?: string;
  confidence?: number;
}

export interface CanonicalEventProjection {
  sanitizedDescription?: string;
  shortDescription?: string;
  displayPriceText?: string;
  ticketUrl?: string;
  ticketProviderLabel: string;
  ticketAvailability: 'not_configured' | 'external_link' | 'on_sale' | 'sold_out' | 'sales_ended';
  isSoldOut: boolean;
  venueLabel: string;
  cityLabel: string;
  countryCode?: string;
  countryLabel?: string;
  locationLabelComma: string;
  locationLabelDot: string;
  latitude?: number;
  longitude?: number;
  hasCoordinates: boolean;
  timezone?: string;
  organizerLabel?: string;
  promoterLabel?: string;
  heroImageUrl?: string;
  galleryImageUrls: string[];
  genres: string[];
  knownArtistNames: string[];
  lineupEntries: import('@/features/events/domain/event-lineup-entry-projection').EventLineupEntryProjection[];
  lineupCompleteness: 'full' | 'partial' | 'none';
  lineupSectionTitle: string;
  hasKnownLineup: boolean;
  qualityState: 'complete' | 'partial' | 'minimal';
  originCount?: number;
  sourceAttributionLabel: string;
  posterMetadata?: PosterMetadataSlot;
}

export function isPlaceholderEventText(value: string | undefined): boolean {
  return !meaningfulEventText(value);
}

export function sanitizeEventDescription(value: string | undefined): string | undefined {
  return normalizePublicEventDescription(value);
}

export function resolveKnownArtistNames(input: {
  title?: string;
  lineup?: string[];
  artists: string[];
  lineupEntries?: EventLineupEntryProjection[];
}): string[] {
  return resolveKnownArtistNamesFromCanonical({
    lineupEntries: input.lineupEntries,
    lineup: input.lineup,
    artists: input.artists,
    eventTitle: input.title,
  });
}

export function stripTrailingCityFromVenue(venue: string, city: string): string {
  const venueLabel = venue.trim();
  const cityLabel = city.trim();
  if (!venueLabel || !cityLabel) {
    return venueLabel;
  }

  const suffix = `, ${cityLabel}`;
  if (venueLabel.toLowerCase().endsWith(suffix.toLowerCase())) {
    return venueLabel.slice(0, -suffix.length).trim();
  }

  return venueLabel;
}

export function formatLocationLabel(
  venue: string,
  city: string,
  style: 'comma' | 'dot' = 'comma',
): string {
  const venueLabel = stripTrailingCityFromVenue(venue, city);
  const cityLabel = city.trim();

  if (!venueLabel && !cityLabel) {
    return '';
  }
  if (!cityLabel) {
    return venueLabel;
  }
  if (!venueLabel || venueLabel.toLowerCase() === cityLabel.toLowerCase()) {
    return cityLabel;
  }

  return style === 'dot' ? `${venueLabel} · ${cityLabel}` : `${venueLabel}, ${cityLabel}`;
}

export function projectCanonicalEventFields(input: {
  title: string;
  description: string;
  venue: string;
  city: string;
  artists: string[];
  lineup?: string[];
  priceText?: string;
  source: string;
  ticketUrl?: string;
  ticketPlatform?: string;
  ticketDestinationClass?: TicketDestinationClass;
  ticketStatus?: CanonicalEventProjection['ticketAvailability'];
  ticketPhases?: TicketPhaseAvailability[];
  countryCode?: string;
  countryLabel?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  organizer?: string;
  promoter?: string;
  imageUrl?: string;
  imageUrls?: string[];
  genres?: string[];
  lineupEntries?: EventLineupEntryProjection[];
  originCount?: number;
  posterMetadata?: PosterMetadataSlot;
}): CanonicalEventProjection {
  const knownArtistNames = resolveKnownArtistNames({
    title: input.title,
    lineup: input.lineup,
    artists: input.artists,
    lineupEntries: input.lineupEntries,
  });
  const structuredArtistCount =
    input.lineupEntries && input.lineupEntries.length > 0
      ? input.lineupEntries.reduce((sum, entry) => sum + entry.artists.length, 0)
      : knownArtistNames.length;
  const lineupCompleteness = inferLineupCompleteness(
    { title: input.title },
    structuredArtistCount,
  );
  const { venueLabel, cityLabel } = normalizeVenueCityLabels(input.venue, input.city);
  const sanitizedDescription = sanitizeEventDescription(input.description);
  const priceSemantics = resolveEventPriceAvailabilitySemantics({
    priceText: input.priceText,
    ticketAvailability: input.ticketStatus,
    ticketPhases: input.ticketPhases,
  });
  const ticketAvailability =
    priceSemantics.availabilityState === 'sold_out'
      ? 'sold_out'
      : priceSemantics.availabilityState === 'unavailable'
        ? 'sales_ended'
        : input.ticketStatus ?? (input.ticketUrl ? 'external_link' : 'not_configured');
  const galleryImageUrls = [
    ...(input.imageUrls ?? []),
    ...(input.imageUrl ? [input.imageUrl] : []),
  ].filter(
    (value, index, values): value is string =>
      Boolean(value?.trim()) && values.indexOf(value) === index,
  );
  const completeFieldCount = [
    sanitizedDescription,
    venueLabel,
    cityLabel,
    input.ticketUrl,
    ...knownArtistNames,
  ].filter(Boolean).length;

  const sourceAttributionLabel = getSourceDisplayLabel(input.source, input.ticketUrl);

  return {
    sanitizedDescription,
    shortDescription: sanitizedDescription?.slice(0, 220),
    displayPriceText:
      priceSemantics.displayPriceText ??
      formatDisplayPriceText(input.priceText) ??
      input.priceText,
    ticketUrl: input.ticketUrl,
    ticketProviderLabel: resolveTicketProviderPresentationLabel({
      purchaseUrl: input.ticketUrl,
      ticketPlatform: input.ticketPlatform,
      destinationClass: input.ticketDestinationClass,
      sourceAttributionLabel,
    }),
    ticketAvailability,
    isSoldOut: ticketAvailability === 'sold_out' || priceSemantics.availabilityState === 'sold_out',
    venueLabel,
    cityLabel,
    countryCode: meaningfulEventText(input.countryCode),
    countryLabel: meaningfulEventText(input.countryLabel),
    locationLabelComma: formatLocationLabel(venueLabel, cityLabel, 'comma'),
    locationLabelDot: formatLocationLabel(venueLabel, cityLabel, 'dot'),
    latitude: hasValidEventCoordinates(input.latitude, input.longitude) ? input.latitude : undefined,
    longitude: hasValidEventCoordinates(input.latitude, input.longitude) ? input.longitude : undefined,
    hasCoordinates: hasValidEventCoordinates(input.latitude, input.longitude),
    timezone: meaningfulEventText(input.timezone),
    organizerLabel: meaningfulEventText(input.organizer),
    promoterLabel: meaningfulEventText(input.promoter),
    heroImageUrl: galleryImageUrls[0],
    galleryImageUrls,
    genres: normalizeCanonicalGenreLabels(input.genres),
    knownArtistNames,
    lineupEntries: input.lineupEntries ?? [],
    lineupCompleteness,
    lineupSectionTitle: resolveLineupSectionTitle(lineupCompleteness, knownArtistNames.length),
    hasKnownLineup: knownArtistNames.length > 0,
    qualityState: completeFieldCount >= 4 ? 'complete' : completeFieldCount >= 2 ? 'partial' : 'minimal',
    originCount: input.originCount,
    sourceAttributionLabel,
    posterMetadata: input.posterMetadata,
  };
}

export function normalizeVenueCityLabels(
  venue: string,
  city: string,
): { venueLabel: string; cityLabel: string } {
  const cityLabel = city.trim();
  const venueLabel = stripTrailingCityFromVenue(venue, cityLabel);
  return { venueLabel, cityLabel };
}
