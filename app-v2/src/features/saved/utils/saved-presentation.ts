import type { EventStatus, EventTicketStatus } from '@/components/discovery/view-models';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { EVENT_REFERENCE_DATE, isUpcomingEvent } from '@/features/events/formatting/date-time';
import {
  isTicketActionDisabled,
  resolveEventNoticeType,
  resolveEventPresentation,
} from '@/features/events/status/event-status-resolver';

export type SavedConsumerStatus = EventStatus | 'unavailable';

export function resolveSavedConsumerStatus(event: EventDisplayModel): SavedConsumerStatus | undefined {
  const presentation = resolveEventPresentation(event);
  return presentation.primaryStatus;
}

export function resolveSavedTicketStatus(event: EventDisplayModel): EventTicketStatus | undefined {
  return resolveEventPresentation(event).ticketStatus;
}

export function isSavedEventUpcoming(event: EventDisplayModel): boolean {
  const status = resolveSavedConsumerStatus(event);
  if (status === 'cancelled' || status === 'unavailable') {
    return false;
  }

  return isUpcomingEvent(event);
}

export function isSavedEventPast(event: EventDisplayModel): boolean {
  return new Date(event.startDateTime).getTime() < EVENT_REFERENCE_DATE.getTime();
}

export function isSavedEventCancelled(event: EventDisplayModel): boolean {
  const notice = resolveEventNoticeType(event);
  return notice === 'cancelled' || event.status === 'archived';
}

export function formatSavedAtLabel(savedAt: string): string {
  const savedDate = new Date(savedAt);
  const diffMs = EVENT_REFERENCE_DATE.getTime() - savedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'Heute gespeichert';
  }

  if (diffDays === 1) {
    return 'Gestern gespeichert';
  }

  return `Vor ${diffDays} Tagen gespeichert`;
}

export { isTicketActionDisabled };
