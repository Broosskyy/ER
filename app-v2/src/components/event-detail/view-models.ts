import type { DiscoveryImageSource } from '@/components/discovery/view-models';
import type { LineupItemViewModel } from '@/components/discovery/view-models';
import type { OrganizerProfileViewModel } from '@/components/profiles/view-models';
import type { TicketSummaryViewModel, TicketTypeViewModel } from '@/components/ticketing/view-models';
import type { EventCardViewModel, EventStatus, EventTicketStatus } from '@/components/discovery/view-models';

export interface EventHeroViewModel {
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
  ticketLabel?: string;
  ticketStatus?: EventTicketStatus;
  status?: EventStatus;
  accessibilityLabel: string;
}

export interface EventInfoItemViewModel {
  id: string;
  icon: 'calendar-outline' | 'time-outline' | 'location-outline' | 'musical-notes-outline' | 'shirt-outline' | 'ticket-outline' | 'people-outline' | 'information-circle-outline';
  label: string;
  value: string;
  secondaryValue?: string;
  pressable?: boolean;
}

export interface EventInfoViewModel {
  description?: string;
  items: EventInfoItemViewModel[];
}

export interface LineupSectionViewModel {
  artists: LineupItemViewModel[];
  tba?: boolean;
  accessibilityLabel: string;
}

export interface VenueDetailViewModel {
  id: string;
  name: string;
  addressLabel: string;
  cityLabel: string;
  image?: DiscoveryImageSource;
  verified?: boolean;
  descriptionLabel?: string;
  accessibilityLabel: string;
}

export interface OrganizerDetailViewModel {
  organizer: OrganizerProfileViewModel;
  moreEventsLabel?: string;
}

export type EventTicketMode = 'native' | 'external' | 'free_rsvp' | 'sold_out' | 'unavailable';

export interface EventTicketSectionViewModel {
  mode: EventTicketMode;
  ticketTypes: TicketTypeViewModel[];
  summary?: TicketSummaryViewModel;
  ctaLabel: string;
  externalUrlLabel?: string;
  salesStartLabel?: string;
  salesEndLabel?: string;
  noticeLabel?: string;
  accessibilityLabel: string;
}

export type EventNoticeType =
  | 'cancelled'
  | 'postponed'
  | 'venue_changed'
  | 'time_changed'
  | 'sold_out'
  | 'age_restriction'
  | 'general';

export interface EventNoticeViewModel {
  type: EventNoticeType;
  title: string;
  message?: string;
}

export interface SimilarEventsViewModel {
  title?: string;
  events: EventCardViewModel[];
  actionLabel?: string;
}
