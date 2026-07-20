import { parseCoordinate } from '../formatting/coordinates';
import { getDefaultTimezone, isValidIsoDateTime } from '../formatting/date-time';
import {
  normalizeCity,
  normalizeOptionalString,
  normalizeRequiredString,
  normalizeStringArray,
  normalizeTitle,
  normalizeVenue,
  slugify,
} from '../formatting/text';
import { normalizeOptionalUrl } from '../formatting/urls';
import type { Event } from '../types/event';
import type { RawEvent } from '../types/raw-event';

function buildStableId(raw: RawEvent): string {
  if (raw.rawId?.trim()) {
    return raw.rawId.trim();
  }

  return `${raw.source}-${raw.sourceEventId}`;
}

function buildSlug(raw: RawEvent, title: string): string {
  if (raw.rawSlug?.trim()) {
    return slugify(raw.rawSlug);
  }

  return slugify(title);
}

function parseRawDateTime(rawDate: string, timezone: string): string | null {
  const trimmed = rawDate.trim();

  if (!trimmed) {
    return null;
  }

  if (isValidIsoDateTime(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  const berlinOffsetMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (berlinOffsetMatch) {
    const [, year, month, day, hour, minute, second = '00'] = berlinOffsetMatch;
    const isoCandidate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    const parsed = new Date(isoCandidate);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (timezone) {
    const parsed = new Date(trimmed);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export interface NormalizeResult {
  event: Event;
  errors: string[];
  warnings: string[];
}

export function normalizeRawEvent(raw: RawEvent, nowIso: string = new Date().toISOString()): NormalizeResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = normalizeTitle(raw.rawTitle);
  const venue = normalizeVenue(raw.rawVenue);
  const city = normalizeCity(raw.rawCity);
  const timezone = normalizeOptionalString(raw.rawTimezone) ?? getDefaultTimezone();
  const startDateTime = parseRawDateTime(raw.rawDate, timezone);
  const endDateTime = raw.rawEndDate ? parseRawDateTime(raw.rawEndDate, timezone) ?? undefined : undefined;

  if (!title) {
    errors.push('Missing title');
  }

  if (!startDateTime) {
    errors.push('Invalid or missing start date');
  }

  if (!venue && !city) {
    errors.push('City or venue is required');
  }

  const latitude = parseCoordinate(raw.rawLatitude);
  const longitude = parseCoordinate(raw.rawLongitude);

  const event: Event = {
    id: buildStableId(raw),
    slug: buildSlug(raw, title || raw.sourceEventId),
    title,
    description: normalizeRequiredString(raw.rawDescription),
    imageUrl: normalizeOptionalUrl(raw.rawImageUrl),
    imageAssetKey: normalizeOptionalString(raw.rawImageAssetKey),
    startDateTime: startDateTime ?? '',
    endDateTime: endDateTime ?? undefined,
    timezone,
    venue,
    address: normalizeOptionalString(raw.rawAddress),
    city,
    country: normalizeOptionalString(raw.rawCountry) ?? 'Germany',
    latitude,
    longitude,
    genres: normalizeStringArray(raw.rawGenres),
    artists: normalizeStringArray(raw.rawArtists),
    lineup: normalizeStringArray(raw.rawLineup),
    organizer: normalizeOptionalString(raw.rawOrganizer),
    ageRestriction: normalizeOptionalString(raw.rawAgeRestriction),
    priceText: normalizeOptionalString(raw.rawPriceText),
    ticketUrl: normalizeOptionalUrl(raw.rawTicketUrl),
    source: normalizeRequiredString(raw.source),
    sourceEventId: normalizeRequiredString(raw.sourceEventId),
    sourceUrl: normalizeOptionalUrl(raw.rawSourceUrl),
    status: 'draft',
    createdAt: raw.importedAt || nowIso,
    updatedAt: nowIso,
  };

  if (!event.ticketUrl && raw.rawTicketUrl?.trim()) {
    warnings.push('Ticket URL could not be normalized');
  }

  if (!event.sourceUrl && raw.rawSourceUrl?.trim()) {
    warnings.push('Source URL could not be normalized');
  }

  if ((latitude !== undefined || longitude !== undefined) && (latitude === undefined || longitude === undefined)) {
    warnings.push('Incomplete coordinates');
  }

  return { event, errors, warnings };
}
