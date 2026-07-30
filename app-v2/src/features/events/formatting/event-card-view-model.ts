import type {
  EventCardViewModel,
  EventListItemViewModel,
} from '@/components/discovery/view-models';

import type { EventDisplayModel } from './display-event';
import { formatWeekdayLabel } from './date-time';
import {
  resolveEventPresentation,
  resolvePrimaryCardStatus,
} from '../status/event-status-resolver';

/** Maps domain display events into discovery card view models for the component library. */
export function toEventCardViewModel(event: EventDisplayModel): EventCardViewModel {
  const primaryGenre = event.genres[0];
  const presentation = resolveEventPresentation(event);

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.date,
    weekdayLabel: formatWeekdayLabel(event.startDateTime, event.timezone),
    timeLabel: event.startTime,
    endTimeLabel: event.endTime,
    venueLabel: event.venue,
    cityLabel: event.city,
    genreLabels: event.genres,
    categoryLabel: primaryGenre,
    organizerLabel: event.organizer,
    ticketLabel: event.priceText,
    ticketStatus: presentation.ticketStatus,
    status: presentation.primaryStatus ?? resolvePrimaryCardStatus(event),
    accessibilityLabel: `${event.title}, ${event.venue}, ${event.city}`,
  };
}

/** Maps domain display events into compact list item view models. */
export function toEventListItemViewModel(event: EventDisplayModel): EventListItemViewModel {
  const presentation = resolveEventPresentation(event);

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.date,
    timeLabel: event.startTime,
    venueLabel: event.venue,
    cityLabel: event.city,
    genreLabels: event.genres,
    status: presentation.primaryStatus,
    accessibilityLabel: `${event.title}, ${event.venue}, ${event.city}`,
  };
}
