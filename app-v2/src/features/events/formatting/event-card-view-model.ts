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
import { resolvePublicTicketPresentation } from './ticket-presentation';

/** Maps domain display events into discovery card view models for the component library. */
export function toEventCardViewModel(event: EventDisplayModel): EventCardViewModel {
  const primaryGenre = event.genres[0];
  const presentation = resolveEventPresentation(event);
  const ticket = resolvePublicTicketPresentation(event);
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
    categoryLabel: primaryGenre,
    organizerLabel: event.organizer,
    ticketLabel: ticket.ticketLabel,
    ticketColorToken: ticket.colorToken,
    ticketStatus: presentation.ticketStatus,
    status: presentation.primaryStatus ?? resolvePrimaryCardStatus(event),
    accessibilityLabel: `${event.title}, ${locationLabel}`,
  };
}

/** Maps domain display events into compact list item view models. */
export function toEventListItemViewModel(event: EventDisplayModel): EventListItemViewModel {
  const presentation = resolveEventPresentation(event);
  const ticket = resolvePublicTicketPresentation(event);
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
    ticketLabel: ticket.ticketLabel,
    ticketColorToken: ticket.colorToken,
    ticketStatus: presentation.ticketStatus,
    status: presentation.primaryStatus,
    accessibilityLabel: `${event.title}, ${locationLabel}`,
  };
}
