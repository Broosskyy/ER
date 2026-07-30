import { normalizeIanaTimezone } from '@/features/events/formatting/date-time';

import type { ParsedTicketPlatformEvent } from './types';

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

export function toNormalizedTicketFields(event: ParsedTicketPlatformEvent) {
  return {
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
  };
}
