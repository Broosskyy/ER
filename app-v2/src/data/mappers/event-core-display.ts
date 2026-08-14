import type { EventDetail, EventSummary, EventTicket } from '@/features/events/types/event-core';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  formatDateLabel,
  formatEventTimeRange,
  getDefaultTimezone,
  hasKnownEventClockTime,
  normalizeIanaTimezone,
} from '@/features/events/formatting/date-time';
import type { Event } from '@/features/events/types/event';

function formatTicketPrice(ticket: EventTicket | null): string | undefined {
  if (!ticket || ticket.priceFromMinor == null) {
    return undefined;
  }

  const amount = ticket.priceFromMinor / 100;
  const formatted = amount.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currency = ticket.currency ?? 'EUR';
  return currency === 'EUR' ? `${formatted} €` : `${formatted} ${currency}`;
}

function mapTicketStatus(
  ticket: EventTicket | null,
): Event['ticketStatus'] | undefined {
  if (!ticket?.ticketUrl) {
    return undefined;
  }

  switch (ticket.salesStatus) {
    case 'sold_out':
      return 'sold_out';
    case 'available':
    case 'on_sale':
      return 'on_sale';
    default:
      return 'external_link';
  }
}

function toDisplayFields(
  summary: EventSummary,
  detail?: Pick<EventDetail, 'description' | 'lineup' | 'officialUrl'>,
): EventDisplayModel {
  const timezone = normalizeIanaTimezone(summary.timezone, getDefaultTimezone());
  const startDateTime = summary.startsAt;
  const endDateTime = summary.endsAt ?? undefined;
  const venueName = summary.venue?.name ?? '';
  const city = summary.venue?.city ?? '';
  const genres = summary.genres.map((genre) => genre.displayName);
  const lineup = detail?.lineup.map((act) => act.billingName);
  const ticket = summary.primaryTicket;
  const hasClock = hasKnownEventClockTime(startDateTime, timezone);
  const timeRange = formatEventTimeRange({
    startDateTime,
    endDateTime,
    timezone,
  });

  return {
    id: summary.id,
    slug: summary.id,
    title: summary.title,
    description: detail?.description ?? '',
    image: summary.imageUrl ? { uri: summary.imageUrl } : ({ uri: '' } as const),
    date: formatDateLabel(startDateTime, timezone),
    startTime: hasClock ? timeRange.split(' – ')[0] ?? timeRange : 'Open',
    endTime: hasClock ? timeRange.split(' – ')[1] : undefined,
    venue: venueName,
    city,
    country: summary.venue?.countryCode ?? '',
    address: summary.venue?.addressLine ?? undefined,
    genres,
    artists: lineup ?? [],
    lineup,
    organizer: summary.organizerName ?? undefined,
    priceText: formatTicketPrice(ticket),
    ticketUrl: ticket?.ticketUrl ?? undefined,
    officialEventUrl: detail?.officialUrl ?? undefined,
    source: 'event-core',
    sourceLabel: '',
    startsAt: startDateTime,
    startDateTime,
    endDateTime,
    timezone,
    latitude: summary.venue?.latitude ?? undefined,
    longitude: summary.venue?.longitude ?? undefined,
    status: 'published',
    lifecycleStatus: 'published',
    venueId: summary.venue?.id,
    ticketProviderLabel: ticket?.provider ?? undefined,
    ticketStatus: mapTicketStatus(ticket),
    venueLabel: venueName,
    cityLabel: city,
    locationLabelComma: venueName && city ? `${venueName}, ${city}` : venueName || city,
  };
}

export function toEventDisplayModelFromSummary(summary: EventSummary): EventDisplayModel {
  return toDisplayFields(summary);
}

export function toEventDisplayModelFromDetail(detail: EventDetail): EventDisplayModel {
  return toDisplayFields(detail, detail);
}
