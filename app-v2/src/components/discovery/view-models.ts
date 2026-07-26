import type { ImageSourcePropType } from 'react-native';

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
  | 'free'
  | 'limited'
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
  name: string;
  image?: DiscoveryImageSource;
  headliner?: boolean;
  subtitleLabel?: string;
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
