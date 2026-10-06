import type { EventCardViewModel, EventStatus, EventTicketStatus } from '@/components/discovery/view-models';

import type { EventDisplayModel } from '../formatting/display-event';
import { EVENT_REFERENCE_DATE, isUpcomingEvent } from '../formatting/date-time';

export function isTicketActionDisabled(event: EventDisplayModel | EventCardViewModel): boolean {
  if ('ticketUrl' in event) {
    return !event.ticketUrl || event.ticketStatus === 'sold_out';
  }
  return event.ticketStatus === 'sold_out' || event.ticketStatus === 'unavailable';
}

export function resolveConsumerEventStatus(
  event: Pick<EventDisplayModel, 'status' | 'startDateTime' | 'cancelledAt' | 'postponedAt'>,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): EventStatus {
  if (event.cancelledAt) return 'cancelled';
  if (event.postponedAt) return 'postponed';
  if (!isUpcomingEvent(
    {
      startDateTime: event.startDateTime,
      endDateTime: undefined,
      timezone: 'Europe/Berlin',
    },
    referenceDate,
  )) return 'unverified';
  return 'upcoming';
}

export function resolveConsumerTicketStatus(
  event: Pick<EventDisplayModel, 'ticketStatus' | 'ticketUrl' | 'priceText'>,
): EventTicketStatus | undefined {
  if (!event.ticketUrl && !event.priceText) {
    return undefined;
  }
  if (!event.ticketUrl) {
    return undefined;
  }
  return event.ticketStatus === 'sold_out' ? 'sold_out' : 'on_sale';
}

export function resolveEventPresentation(event: EventDisplayModel) {
  return {
    primaryStatus: resolveConsumerEventStatus(event),
    ticketStatus: resolveConsumerTicketStatus(event),
  };
}

export function resolvePrimaryCardStatus(event: EventDisplayModel): EventStatus {
  return resolveConsumerEventStatus(event);
}

export function resolvePublicTicketPresentation(event: EventDisplayModel) {
  if (!event.ticketUrl && !event.priceText) {
    return {
      ticketLabel: undefined,
      colorToken: 'default' as const,
      ticketStatus: undefined,
    };
  }

  const ticketStatus = resolveConsumerTicketStatus(event);
  return {
    ticketLabel: event.priceText,
    colorToken: 'default' as const,
    ticketStatus,
  };
}

export function isFeaturedConsumerEvent(_eventId: string): boolean {
  return false;
}
