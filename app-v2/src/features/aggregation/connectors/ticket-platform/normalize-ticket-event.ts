import { createHash } from 'node:crypto';

import { normalizeIanaTimezone } from '@/features/events/formatting/date-time';

import type { ParsedTicketPlatformEvent } from './types';
import { TICKET_IO_DATA_QUALITY_REPAIR_VERSION } from './ticket-io-repair';

const TICKET_EVENT_HASH_FIELDS = [
  'title',
  'description',
  'startDate',
  'endDate',
  'venueName',
  'venueAddress',
  'cityName',
  'ticketUrl',
  'imageUrl',
  'priceAmount',
  'priceCurrency',
  'priceText',
  'availability',
  'cancelled',
] as const;

export function resolveTicketShopBaseUrl(shopSlug: string): string {
  const slug = shopSlug.trim().replace(/^https?:\/\//, '').split('/')[0] ?? shopSlug;
  if (slug.includes('.ticket.io')) {
    return `https://${slug}`;
  }
  return `https://${slug}.ticket.io`;
}

export function buildCanonicalTicketUrl(baseUrl: string, pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    url.hash = '';
    return url.toString().replace(/\/?$/, '/');
  }
  const base = baseUrl.replace(/\/?$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`.replace(/\/?$/, '/');
}

export function normalizeTicketTimezone(
  isoDateTime: string | undefined,
  fallback: string = 'Europe/Berlin',
): string {
  if (!isoDateTime) {
    return fallback;
  }

  const offsetMatch = isoDateTime.match(/([+-]\d{2}:\d{2})$/);
  if (offsetMatch) {
    return normalizeIanaTimezone(`UTC${offsetMatch[1]}`, fallback);
  }

  return normalizeIanaTimezone(fallback, fallback);
}

export function buildNormalizedTicketEventHash(
  event: Pick<ParsedTicketPlatformEvent, (typeof TICKET_EVENT_HASH_FIELDS)[number]>,
): string {
  const payload = TICKET_EVENT_HASH_FIELDS.map((field) => {
    const value = event[field];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  }).join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function toNormalizedTicketFields(event: ParsedTicketPlatformEvent) {
  const fields = {
    externalId: event.externalId,
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: normalizeTicketTimezone(event.startDate, event.timezone),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    cityName: event.cityName,
    countryCode: event.countryCode ?? 'DE',
    latitude: event.latitude,
    longitude: event.longitude,
    organizerName: event.organizerName,
    artistNames: event.artistNames,
    genreNames: event.genreNames,
    imageUrl: event.imageUrl,
    ticketUrl: event.ticketUrl,
    eventUrl: event.eventUrl,
    priceAmount: event.priceAmount,
    priceCurrency: event.priceCurrency,
    priceText: event.priceText,
    availability: event.availability,
    cancelled: event.cancelled,
  };
  return {
    ...fields,
    normalizedHash: event.normalizedHash ?? buildNormalizedTicketEventHash(event),
  };
}
