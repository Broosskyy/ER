import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

/** Canonical import event — single normalized shape for all external sources. */
export interface CanonicalImportEvent {
  externalId: string;
  sourceId: string;
  sourceName: string;
  sourceUrl?: string;
  title: string;
  subtitle?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  isAllDay?: boolean;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  genreNames?: string[];
  artistNames?: string[];
  organizerName?: string;
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  imageUrls?: string[];
  priceAmount?: number;
  priceCurrency?: string;
  importId?: string;
  originalLink?: string;
  rawSourceType: NormalizedEventCandidate['rawSourceType'];
  sourceMetadata?: Record<string, unknown>;
}

export function extractTimeLabel(isoDate: string): string | undefined {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().slice(11, 16);
}

export function mapNormalizedCandidateToCanonical(
  candidate: NormalizedEventCandidate,
  source: { id: string; name: string },
): CanonicalImportEvent {
  const imageUrls = candidate.imageUrls?.length
    ? candidate.imageUrls
    : candidate.imageUrl
      ? [candidate.imageUrl]
      : undefined;

  return {
    externalId: candidate.externalId,
    sourceId: candidate.sourceId ?? source.id,
    sourceName: candidate.sourceName ?? source.name,
    sourceUrl: candidate.sourceUrl,
    title: candidate.title,
    subtitle: candidate.subtitle,
    description: candidate.description,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    startTime: extractTimeLabel(candidate.startDate),
    endTime: candidate.endDate ? extractTimeLabel(candidate.endDate) : undefined,
    timezone: candidate.timezone,
    isAllDay: candidate.isAllDay,
    venueName: candidate.venueName,
    venueAddress: candidate.venueAddress,
    cityName: candidate.cityName,
    countryCode: candidate.countryCode,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    genreNames: candidate.genreNames,
    artistNames: candidate.artistNames,
    organizerName: candidate.organizerName,
    ticketUrl: candidate.ticketUrl,
    eventUrl: candidate.eventUrl,
    imageUrl: candidate.imageUrl ?? imageUrls?.[0],
    imageUrls,
    priceAmount: candidate.priceAmount,
    priceCurrency: candidate.priceCurrency,
    importId: candidate.importId ?? candidate.externalId,
    originalLink: candidate.originalLink ?? candidate.eventUrl ?? candidate.sourceUrl,
    rawSourceType: candidate.rawSourceType,
    sourceMetadata: candidate.sourceMetadata,
  };
}
