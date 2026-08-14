import type {
  EventCardViewModel,
  EventListItemViewModel,
} from '@/components/discovery/view-models';

import type { EventDisplayModel } from './display-event';
import { formatWeekdayLabel } from './date-time';
import {
  resolveConsumerEventStatus,
  resolveConsumerTicketStatus,
} from '../status/event-status-resolver';

export function toEventCardViewModel(event: EventDisplayModel): EventCardViewModel {
  const venueLabel = event.venueLabel ?? event.venue;
  const cityLabel = event.cityLabel ?? event.city;
  const locationLabel = event.locationLabelComma ?? `${venueLabel}, ${cityLabel}`;

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.date,
    weekdayLabel: formatWeekdayLabel(event.startDateTime, event.timezone),
    timeLabel: event.startTime,
    endTimeLabel: event.endTime,
    venueLabel,
    cityLabel,
    genreLabels: event.genres,
    categoryLabel: event.genres[0],
    organizerLabel: event.organizer,
    ticketLabel: event.priceText,
    ticketColorToken: undefined,
    ticketStatus: resolveConsumerTicketStatus(event),
    status: resolveConsumerEventStatus(event),
    accessibilityLabel: `${event.title}, ${locationLabel}`,
  };
}

export function toEventListItemViewModel(event: EventDisplayModel): EventListItemViewModel {
  const venueLabel = event.venueLabel ?? event.venue;
  const cityLabel = event.cityLabel ?? event.city;
  const locationLabel = event.locationLabelComma ?? `${venueLabel}, ${cityLabel}`;

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.date,
    timeLabel: event.startTime,
    venueLabel,
    cityLabel,
    genreLabels: event.genres,
    ticketLabel: event.priceText,
    ticketStatus: resolveConsumerTicketStatus(event),
    status: resolveConsumerEventStatus(event),
    accessibilityLabel: `${event.title}, ${locationLabel}`,
  };
}
