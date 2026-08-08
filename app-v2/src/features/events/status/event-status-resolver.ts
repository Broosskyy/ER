import type { EventStatus, EventTicketStatus } from '@/components/discovery/view-models';

import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  isSemanticallyFreeEvent,
  resolveEventPriceAvailabilitySemantics,
  toDiscoveryTicketStatus,
} from '@/features/events/domain/event-price-availability-semantics';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { isConsumerEventTimeEnded } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { isFeaturedEventId } from '../data/home-config';
import type { EventDisplayModel } from '../formatting/display-event';
import {
  EVENT_REFERENCE_DATE,
  addDays,
  isUpcomingEvent,
  parseIsoDateTime,
  startOfDay,
} from '../formatting/date-time';

export type ConsumerEventStatus =
  | 'cancelled'
  | 'postponed'
  | 'date_changed'
  | 'venue_changed'
  | 'sold_out'
  | 'selling_fast'
  | 'free'
  | 'today'
  | 'tomorrow'
  | 'this_weekend'
  | 'featured'
  | 'newly_added'
  | 'verified'
  | 'official_organizer'
  | 'external_source'
  | 'age_restricted'
  | 'upcoming';

export interface EventPresentationStatus {
  primaryStatus?: EventStatus;
  ticketStatus?: EventTicketStatus;
  consumerStatuses: ConsumerEventStatus[];
}

const STATUS_PRIORITY: ConsumerEventStatus[] = [
  'cancelled',
  'postponed',
  'date_changed',
  'venue_changed',
  'sold_out',
  'selling_fast',
  'free',
  'today',
  'tomorrow',
  'this_weekend',
  'featured',
  'newly_added',
  'verified',
  'official_organizer',
  'external_source',
  'age_restricted',
  'upcoming',
];

const DEMO_STATUS_OVERRIDES: Partial<Record<string, ConsumerEventStatus>> = {
  'klangkuenstler-berghain': 'postponed',
};

const NEWLY_ADDED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isSameCalendarDay(isoDateTime: string, referenceDate: Date): boolean {
  const eventDate = parseIsoDateTime(isoDateTime);
  if (!eventDate) {
    return false;
  }

  return (
    eventDate.getFullYear() === referenceDate.getFullYear() &&
    eventDate.getMonth() === referenceDate.getMonth() &&
    eventDate.getDate() === referenceDate.getDate()
  );
}

function isTomorrowEvent(isoDateTime: string, referenceDate: Date = EVENT_REFERENCE_DATE): boolean {
  const tomorrow = addDays(startOfDay(referenceDate), 1);
  return isSameCalendarDay(isoDateTime, tomorrow);
}

function isThisWeekendEvent(isoDateTime: string, referenceDate: Date = EVENT_REFERENCE_DATE): boolean {
  const eventDate = parseIsoDateTime(isoDateTime);
  if (!eventDate) {
    return false;
  }

  const day = eventDate.getDay();
  const referenceDay = referenceDate.getDay();
  const daysUntilSaturday = (6 - referenceDay + 7) % 7;
  const weekendStart = addDays(startOfDay(referenceDate), daysUntilSaturday);
  const weekendEnd = addDays(weekendStart, 1);
  weekendEnd.setHours(23, 59, 59, 999);

  return eventDate >= weekendStart && eventDate <= weekendEnd;
}

function resolvePriceTicketStatus(event: EventDisplayModel): EventTicketStatus | undefined {
  if (isConsumerEventTimeEnded({ endDateTime: event.endDateTime })) {
    return undefined;
  }

  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.officialEventUrl,
    sourceUrl: event.sourceUrl,
    priceText: event.displayPriceText ?? event.priceText,
    ticketStatus:
      event.canonicalTicketStatus ??
      (event.ticketAvailability === 'sold_out'
        ? 'sold_out'
        : event.ticketAvailability === 'on_sale'
          ? 'on_sale'
          : event.ticketAvailability === 'external_link'
            ? 'external_link'
            : event.ticketAvailability === 'sales_ended'
              ? 'sales_ended'
              : undefined),
    ticketPhases: event.ticketPhases,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
  });

  const fromCanonical = mapCanonicalAvailabilityToTicketBadge(
    event.canonicalAvailability ?? canonical.availability,
    canonical.ticketStatus,
  );
  if (fromCanonical) {
    return fromCanonical;
  }

  const semantics = resolveEventPriceAvailabilitySemantics({
    priceText: event.displayPriceText ?? event.priceText,
    lifecycleStatus: event.lifecycleStatus,
    ticketAvailability: event.ticketAvailability,
    ticketPhases: event.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
  });
  return toDiscoveryTicketStatus(semantics);
}

function resolveConsumerStatuses(event: EventDisplayModel): ConsumerEventStatus[] {
  const statuses = new Set<ConsumerEventStatus>();
  const demoOverride = DEMO_STATUS_OVERRIDES[event.id];

  if (demoOverride) {
    statuses.add(demoOverride);
  }

  if (event.lifecycleStatus === 'cancelled') {
    statuses.add('cancelled');
  }
  if (event.lifecycleStatus === 'postponed') {
    statuses.add('postponed');
  }
  if (event.lifecycleNotices?.includes('date_changed')) {
    statuses.add('date_changed');
  }
  if (event.lifecycleNotices?.includes('venue_changed')) {
    statuses.add('venue_changed');
  }
  if (event.lifecycleStatus === 'sold_out') {
    statuses.add('sold_out');
  }

  if (event.status === 'archived' && !statuses.has('cancelled')) {
    statuses.add('cancelled');
  }

  const ticketStatus = resolvePriceTicketStatus(event);
  if (ticketStatus === 'sold_out') {
    statuses.add('sold_out');
  }

  if (ticketStatus === 'limited') {
    statuses.add('selling_fast');
  }

  if (isSemanticallyFreeEvent({
    priceText: event.displayPriceText ?? event.priceText,
    lifecycleStatus: event.lifecycleStatus,
    ticketAvailability: event.ticketAvailability,
  })) {
    statuses.add('free');
  }

  if (!statuses.has('cancelled') && !statuses.has('postponed')) {
    if (isSameCalendarDay(event.startDateTime, EVENT_REFERENCE_DATE)) {
      statuses.add('today');
    } else if (isTomorrowEvent(event.startDateTime)) {
      statuses.add('tomorrow');
    } else if (isThisWeekendEvent(event.startDateTime)) {
      statuses.add('this_weekend');
    } else if (isUpcomingEvent(event)) {
      statuses.add('upcoming');
    }
  }

  if (isFeaturedEventId(event.id)) {
    statuses.add('featured');
  }

  const publishedAt = event.publishedAt ?? event.createdAt;
  if (publishedAt) {
    const publishedMs = Date.parse(publishedAt);
    if (!Number.isNaN(publishedMs) && EVENT_REFERENCE_DATE.getTime() - publishedMs <= NEWLY_ADDED_WINDOW_MS) {
      statuses.add('newly_added');
    }
  }

  if (event.ageRestriction) {
    statuses.add('age_restricted');
  }

  if (event.source && event.source !== 'demo' && event.sourceUrl) {
    statuses.add('external_source');
  }

  return STATUS_PRIORITY.filter((status) => statuses.has(status));
}

function mapConsumerToPresentationStatus(status: ConsumerEventStatus): EventStatus | undefined {
  switch (status) {
    case 'cancelled':
      return 'cancelled';
    case 'postponed':
    case 'date_changed':
      return 'postponed';
    case 'sold_out':
      return 'sold_out';
    case 'today':
      return 'today';
    case 'verified':
      return 'verified';
    case 'upcoming':
    case 'tomorrow':
    case 'this_weekend':
    case 'featured':
    case 'newly_added':
    case 'selling_fast':
    case 'free':
    case 'venue_changed':
    case 'official_organizer':
    case 'external_source':
    case 'age_restricted':
    default:
      return undefined;
  }
}

/** Resolves consumer-facing event presentation for cards, detail, saved, and map. */
export function resolveEventPresentation(event: EventDisplayModel): EventPresentationStatus {
  const consumerStatuses = resolveConsumerStatuses(event);
  const primaryConsumer = consumerStatuses[0];
  const ticketStatus = resolvePriceTicketStatus(event);

  return {
    primaryStatus: primaryConsumer ? mapConsumerToPresentationStatus(primaryConsumer) : undefined,
    ticketStatus:
      primaryConsumer === 'cancelled' || primaryConsumer === 'postponed'
        ? undefined
        : ticketStatus,
    consumerStatuses,
  };
}

export function resolvePrimaryCardStatus(event: EventDisplayModel): EventStatus | undefined {
  return resolveEventPresentation(event).primaryStatus;
}

export function resolvePrimaryTicketStatus(event: EventDisplayModel): EventTicketStatus | undefined {
  return resolveEventPresentation(event).ticketStatus;
}

export function resolveEventNoticeType(
  event: EventDisplayModel,
): 'cancelled' | 'postponed' | 'sold_out' | 'venue_changed' | 'time_changed' | undefined {
  if (event.lifecycleNotices?.includes('venue_changed')) {
    return 'venue_changed';
  }

  if (event.lifecycleNotices?.includes('time_changed') || event.lifecycleNotices?.includes('date_changed')) {
    return 'time_changed';
  }

  const { consumerStatuses } = resolveEventPresentation(event);

  if (consumerStatuses.includes('cancelled')) {
    return 'cancelled';
  }

  if (consumerStatuses.includes('postponed') || consumerStatuses.includes('date_changed')) {
    return 'postponed';
  }

  if (consumerStatuses.includes('venue_changed')) {
    return 'venue_changed';
  }

  if (consumerStatuses.includes('sold_out')) {
    return 'sold_out';
  }

  return undefined;
}

export function isTicketActionDisabled(event: EventDisplayModel): boolean {
  if (isConsumerEventTimeEnded({ endDateTime: event.endDateTime })) {
    return true;
  }

  const notice = resolveEventNoticeType(event);
  return notice === 'cancelled' || notice === 'sold_out';
}

export {
  isSameCalendarDay,
  isTomorrowEvent,
  isThisWeekendEvent,
};
