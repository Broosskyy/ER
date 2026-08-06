import type { ImageSourcePropType } from 'react-native';

import type { SemanticColorToken } from '@/design/ticket-semantics';

/**
 * Presentation-only models for discovery components.
 * Parents resolve domain records, formatted labels, and image sources beforehand.
 */
export type DiscoveryImageSource = ImageSourcePropType;

/**
 * Ticket availability and issued-ticket display states.
 *
 * This stays a presentation union: it does not express an order workflow or
 * authorize any ticket transition.
 */
export type EventTicketStatus =
  | 'available'
  | 'on_sale'
  | 'free'
  | 'limited'
  | 'presale'
  | 'coming_soon'
  | 'waitlist'
  | 'reserved'
  | 'paid'
  | 'valid'
  | 'used'
  | 'cancelled'
  | 'refunded'
  | 'expired'
  | 'sold_out'
  | 'unavailable';

export interface EventCardViewModel {
  id: string;
  title: string;
  image?: DiscoveryImageSource;
  dateLabel: string;
  weekdayLabel?: string;
  timeLabel?: string;
  endTimeLabel?: string;
  venueLabel: string;
  cityLabel: string;
  genreLabels: string[];
  categoryLabel?: string;
  organizerLabel?: string;
  ticketLabel?: string;
  ticketColorToken?: SemanticColorToken;
  ticketStatus?: EventTicketStatus;
  status?: EventStatus;
  verified?: boolean;
  savedAtLabel?: string;
  accessibilityLabel: string;
}

export interface EventListItemViewModel {
  id: string;
  title: string;
  image?: DiscoveryImageSource;
  dateLabel: string;
  timeLabel?: string;
  venueLabel: string;
  cityLabel: string;
  genreLabels?: string[];
  ticketLabel?: string;
  ticketColorToken?: SemanticColorToken;
  ticketStatus?: EventTicketStatus;
  status?: EventStatus;
  accessibilityLabel: string;
}

export interface VenueListItemViewModel {
  id: string;
  name: string;
  image?: DiscoveryImageSource;
  cityLabel: string;
  subtitleLabel?: string;
  verified?: boolean;
  accessibilityLabel: string;
}

export interface OrganizerListItemViewModel {
  id: string;
  name: string;
  image?: DiscoveryImageSource;
  typeLabel?: string;
  subtitleLabel?: string;
  verified?: boolean;
  accessibilityLabel: string;
}

export interface LineupItemViewModel {
  id?: string;
  name: string;
  image?: DiscoveryImageSource;
  headliner?: boolean;
  subtitleLabel?: string;
  profileNavigable?: boolean;
  accessibilityLabel: string;
}

/**
 * Current search mockups show event results only. Other kinds stay out of the
 * presentational surface until a visual reference defines their layouts.
 */
export interface SearchResultItemViewModel extends EventListItemViewModel {
  kind: 'event';
}

export type EventStatus =
  | 'upcoming'
  | 'today'
  | 'sold_out'
  | 'cancelled'
  | 'postponed'
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'unverified';

export interface EventDiscoveryTileViewModel {
  id: string;
  title: string;
  image?: DiscoveryImageSource;
  dateLabel: string;
  timeLabel?: string;
  venueLabel: string;
  cityLabel: string;
  status?: EventStatus;
  ticketStatus?: EventTicketStatus;
  ticketLabel?: string;
  ticketColorToken?: SemanticColorToken;
  accessibilityLabel: string;
}

export function toEventDiscoveryTileViewModel(
  event: Pick<
    EventCardViewModel,
    | 'id'
    | 'title'
    | 'image'
    | 'dateLabel'
    | 'timeLabel'
    | 'venueLabel'
    | 'cityLabel'
    | 'status'
    | 'ticketStatus'
    | 'ticketLabel'
    | 'ticketColorToken'
    | 'accessibilityLabel'
  >,
): EventDiscoveryTileViewModel {
  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    venueLabel: event.venueLabel,
    cityLabel: event.cityLabel,
    status: event.status,
    ticketStatus: event.ticketStatus,
    ticketLabel: event.ticketLabel,
    ticketColorToken: event.ticketColorToken,
    accessibilityLabel: event.accessibilityLabel,
  };
}
