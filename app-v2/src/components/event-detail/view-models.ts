import type { DiscoveryImageSource } from '@/components/discovery/view-models';
import type { LineupItemViewModel } from '@/components/discovery/view-models';
import type { OrganizerProfileViewModel } from '@/components/profiles/view-models';
import type { TicketSummaryViewModel, TicketTypeViewModel } from '@/components/ticketing/view-models';
import type { EventCardViewModel, EventStatus, EventTicketStatus } from '@/components/discovery/view-models';
import type { SemanticColorToken } from '@/design/ticket-semantics';
import type { EventAttributeBadge } from '@/features/events/domain/canonical-event-attribute-types';

export interface EventHeroViewModel {
  id: string;
  title: string;
  image?: DiscoveryImageSource;
  galleryImageUrls?: string[];
  dateLabel: string;
  weekdayLabel?: string;
  timeLabel?: string;
  endTimeLabel?: string;
  venueLabel: string;
  cityLabel: string;
  genreLabels: string[];
  attributeBadges?: EventAttributeBadge[];
  categoryLabel?: string;
  ticketLabel?: string;
  ticketColorToken?: SemanticColorToken;
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
  billingRows?: LineupBillingRowViewModel[];
  tba?: boolean;
  placeholderMessage?: string;
  accessibilityLabel: string;
  sectionTitle?: string;
  lineupCompleteness?: 'full' | 'partial' | 'none';
}

export interface LineupBillingRowViewModel {
  id: string;
  billingRelation: import('@/features/aggregation/domain/canonical-lineup-entry').BillingRelation;
  artists: LineupItemViewModel[];
  accessibilityLabel: string;
}

export interface TimetableSlotViewModel {
  id: string;
  stageLabel: string;
  artistName: string;
  startLabel: string;
  endLabel?: string;
  artistId?: string;
  profileNavigable?: boolean;
  accessibilityLabel: string;
}

export interface TimetableSectionViewModel {
  slots: TimetableSlotViewModel[];
  placeholderMessage?: string;
  accessibilityLabel: string;
}

export interface VenueDetailViewModel {
  id: string;
  name: string;
  addressLabel?: string;
  cityLabel: string;
  image?: DiscoveryImageSource;
  verified?: boolean;
  descriptionLabel?: string;
  profileNavigable?: boolean;
  accessibilityLabel: string;
}

export interface OrganizerDetailViewModel {
  organizer: OrganizerProfileViewModel;
  moreEventsLabel?: string;
  profileNavigable?: boolean;
}

export type EventTicketMode = 'native' | 'external' | 'free_rsvp' | 'sold_out' | 'unavailable';

export interface EventTicketSectionViewModel {
  mode: EventTicketMode;
  ticketTypes: TicketTypeViewModel[];
  summary?: TicketSummaryViewModel;
  showSummary?: boolean;
  ctaLabel: string;
  priceLabel?: string;
  availabilityLabel?: string;
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
