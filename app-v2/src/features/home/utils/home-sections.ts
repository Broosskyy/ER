import {
  EVENT_REFERENCE_DATE,
  isThisWeekEvent,
  isUpcomingEvent,
} from '@/features/events/formatting/date-time';
import type { Event } from '@/features/events/types/event';
import { isFeaturedEventId } from '@/features/events/config/home-config';

function isSameDay(isoDateTime: string, referenceDate: Date): boolean {
  const eventDate = new Date(isoDateTime);
  return (
    eventDate.getFullYear() === referenceDate.getFullYear() &&
    eventDate.getMonth() === referenceDate.getMonth() &&
    eventDate.getDate() === referenceDate.getDate()
  );
}

export function getTonightEvents(
  events: Event[],
  referenceDate: Date = EVENT_REFERENCE_DATE,
): Event[] {
  return events.filter(
    (event) => isSameDay(event.startDateTime, referenceDate) && !isFeaturedEventId(event.id),
  );
}

export function getWeekendEvents(
  events: Event[],
  referenceDate: Date = EVENT_REFERENCE_DATE,
): Event[] {
  return events.filter((event) => {
    if (isFeaturedEventId(event.id)) {
      return false;
    }

    if (isSameDay(event.startDateTime, referenceDate)) {
      return false;
    }

    return isThisWeekEvent(event, referenceDate);
  });
}

export function getMoreUpcomingEvents(
  events: Event[],
  referenceDate: Date = EVENT_REFERENCE_DATE,
): Event[] {
  const featuredOrTonightOrWeek = new Set(
    [
      ...events.filter((event) => isFeaturedEventId(event.id)),
      ...getTonightEvents(events, referenceDate),
      ...getWeekendEvents(events, referenceDate),
    ].map((event) => event.id),
  );

  return events.filter(
    (event) => isUpcomingEvent(event, referenceDate) && !featuredOrTonightOrWeek.has(event.id),
  );
}
