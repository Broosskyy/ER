import type { EventDetail, EventSummary, EventTicket } from '@/features/events/types/event-core';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { resolveConsumerOfficialSource } from '@/features/events/sources/consumer-official-source';
import { resolveConsumerTicketPresentation } from '@/features/events/tickets/consumer-ticket-safety-gate';
import {
  formatDateLabel,
  formatEventTimeRange,
  getDefaultTimezone,
  hasKnownEventClockTime,
  normalizeIanaTimezone,
} from '@/features/events/formatting/date-time';
import type { Event } from '@/features/events/types/event';

function mapTicketStatus(
  ticket: EventTicket | null,
  presentation: ReturnType<typeof resolveConsumerTicketPresentation>,
): Event['ticketStatus'] | undefined {
  if (!presentation.ticketUrl && !presentation.priceText) {
    return undefined;
  }
  return presentation.ticketStatus;
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
  const ticketPresentation = resolveConsumerTicketPresentation(ticket);
  const officialSource = resolveConsumerOfficialSource({
    officialUrl: detail?.officialUrl ?? null,
    organizerName: summary.organizerName,
    eventTitle: summary.title,
    startsAt: summary.startsAt,
    imageUrl: summary.imageUrl,
    venueOfficialUrl: summary.venue?.officialUrl,
    venueName: summary.venue?.name,
    ticket,
    purchaseTicketUrl: ticketPresentation.ticketUrl,
  });
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
    priceText: ticketPresentation.priceText,
    ticketUrl: ticketPresentation.ticketUrl,
    eventSourceUrl: officialSource.eventSourceUrl,
    officialEventUrl: officialSource.officialEventUrl,
    organizerSocialUrl: officialSource.organizerSocialUrl,
    venueSocialUrl: officialSource.venueSocialUrl,
    organizerWebsiteUrl: officialSource.organizerWebsiteUrl,
    sourceImageUrl: officialSource.sourceImageUrl,
    source: 'event-core',
    sourceLabel: officialSource.sourceLabel,
    sourceUrl: officialSource.eventSourceUrl,
    visibleSources: officialSource.visibleLinks,
    organizerLinks: officialSource.organizerLinks,
    officialSourceMissing: officialSource.officialSourceMissing,
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
    ticketStatus: mapTicketStatus(ticket, ticketPresentation),
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
