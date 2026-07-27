import type { EventHeroViewModel, EventInfoViewModel, EventNoticeViewModel, EventTicketSectionViewModel, LineupSectionViewModel, OrganizerDetailViewModel, SimilarEventsViewModel, VenueDetailViewModel } from '@/components/event-detail/view-models';
import {
  cancelledEvent,
  clubNightEvent,
  hardTechnoEvent,
  postponedEvent,
  previewLineupItem,
  previewOrganizer,
  previewVenue,
  soldOutFestivalEvent,
} from '@/components/discovery/preview-fixtures';
import { earlyBirdTicket, soldOutRegularTicket, ticketSummary } from '@/components/preview/phase-2b-fixtures';
import type { OrganizerProfileViewModel } from '@/components/profiles/view-models';
import type { SavedEmptyViewModel, SavedEventViewModel, SavedFilterViewModel, SavedSectionViewModel, SavedSortViewModel } from '@/components/saved/view-models';

export const voidHero: EventHeroViewModel = {
  id: hardTechnoEvent.id,
  title: hardTechnoEvent.title,
  dateLabel: hardTechnoEvent.dateLabel,
  weekdayLabel: hardTechnoEvent.weekdayLabel,
  timeLabel: '23:00',
  endTimeLabel: '08:00',
  venueLabel: hardTechnoEvent.venueLabel,
  cityLabel: hardTechnoEvent.cityLabel,
  genreLabels: hardTechnoEvent.genreLabels,
  categoryLabel: hardTechnoEvent.categoryLabel,
  ticketLabel: hardTechnoEvent.ticketLabel,
  ticketStatus: hardTechnoEvent.ticketStatus,
  status: hardTechnoEvent.status,
  accessibilityLabel: hardTechnoEvent.accessibilityLabel,
};

export const soldOutHero: EventHeroViewModel = {
  ...voidHero,
  id: soldOutFestivalEvent.id,
  title: soldOutFestivalEvent.title,
  ticketLabel: undefined,
  ticketStatus: 'sold_out',
  status: 'sold_out',
  accessibilityLabel: soldOutFestivalEvent.accessibilityLabel,
};

export const cancelledHero: EventHeroViewModel = {
  ...voidHero,
  id: cancelledEvent.id,
  title: cancelledEvent.title,
  status: 'cancelled',
  ticketStatus: undefined,
  ticketLabel: undefined,
  accessibilityLabel: cancelledEvent.accessibilityLabel,
};

export const postponedHero: EventHeroViewModel = {
  ...voidHero,
  id: postponedEvent.id,
  title: postponedEvent.title,
  status: 'postponed',
  ticketStatus: 'free',
  ticketLabel: 'Kostenlos',
  accessibilityLabel: postponedEvent.accessibilityLabel,
};

export const longDescription =
  'Eine Nacht voller treibendem Techno in der legendären Sisyphos. 10 Stunden Rave, besondere Deko, starke Sounds und eine einzigartige Atmosphäre. Die VOID Collective kuratiert eine Reise durch dunkle Klanglandschaften, hypnotische Grooves und energiegeladene Peak-Time-Momente. Erwarte sorgfältig ausgewählte Residents, überraschende B2B-Sets und eine Crowd, die den Dancefloor bis zum Sonnenaufgang trägt.';

export const voidEventInfo: EventInfoViewModel = {
  description: longDescription,
  items: [
    { id: 'date', icon: 'calendar-outline', label: 'Datum', value: 'Samstag, 24. Mai 2025' },
    { id: 'time', icon: 'time-outline', label: 'Zeit', value: '23:00 – 08:00' },
    { id: 'genre', icon: 'musical-notes-outline', label: 'Genre', value: 'Techno, Hard Techno' },
    { id: 'entry', icon: 'ticket-outline', label: 'Eintritt', value: 'Ab 18 Jahren' },
    { id: 'dress', icon: 'shirt-outline', label: 'Dresscode', value: 'Black only' },
  ],
};

export const voidLineup: LineupSectionViewModel = {
  artists: [
    previewLineupItem,
    { name: 'Klangkuenstler', subtitleLabel: '23:30 – 01:30', accessibilityLabel: 'Klangkuenstler' },
    { name: 'Dax J', subtitleLabel: '01:30 – 03:30', accessibilityLabel: 'Dax J' },
  ],
  accessibilityLabel: 'Line-up für VOID Techno Saturday',
};

export const tbaLineup: LineupSectionViewModel = {
  artists: [],
  tba: true,
  accessibilityLabel: 'Line-up TBA',
};

export const sisyphosVenue: VenueDetailViewModel = {
  id: previewVenue.id,
  name: previewVenue.name,
  addressLabel: previewVenue.subtitleLabel ?? 'Hauptstraße 15, 10317 Berlin',
  cityLabel: previewVenue.cityLabel,
  verified: previewVenue.verified,
  descriptionLabel: 'Legendärer Open-Air-Club mit wechselnden Indoor- und Outdoor-Areas.',
  accessibilityLabel: previewVenue.accessibilityLabel,
};

const voidOrganizer: OrganizerProfileViewModel = {
  id: 'void',
  name: 'VOID',
  description: 'Berliner Kollektiv für dunklen Techno und immersive Clubnächte.',
  eventCountLabel: '12',
  followerCountLabel: '4.8K',
  verificationStatus: 'verified',
  claimStatus: 'verified',
  accessibilityLabel: 'Verifizierter Veranstalter VOID',
};

export const voidOrganizerDetail: OrganizerDetailViewModel = {
  organizer: voidOrganizer,
  moreEventsLabel: '3 weitere Events von VOID',
};

export const nativeTicketSection: EventTicketSectionViewModel = {
  mode: 'native',
  ticketTypes: [earlyBirdTicket],
  summary: ticketSummary,
  ctaLabel: 'Tickets sichern',
  accessibilityLabel: 'Native Ticketing für VOID Techno Saturday',
};

export const externalTicketSection: EventTicketSectionViewModel = {
  mode: 'external',
  ticketTypes: [],
  ctaLabel: 'Tickets extern kaufen',
  externalUrlLabel: 'ra.co',
  accessibilityLabel: 'Externe Tickets über Resident Advisor',
};

export const freeRsvpTicketSection: EventTicketSectionViewModel = {
  mode: 'free_rsvp',
  ticketTypes: [],
  ctaLabel: 'Kostenlos RSVP',
  accessibilityLabel: 'Kostenloses RSVP für Rheinland Open Air',
};

export const soldOutTicketSection: EventTicketSectionViewModel = {
  mode: 'sold_out',
  ticketTypes: [soldOutRegularTicket],
  ctaLabel: 'Ausverkauft',
  noticeLabel: 'Alle Ticketkontingente sind vergeben.',
  accessibilityLabel: 'Ausverkauftes Ticketangebot',
};

export const cancelledNotice: EventNoticeViewModel = {
  type: 'cancelled',
  title: 'Event abgesagt',
  message: 'VOID: Techno Saturday wurde vom Veranstalter abgesagt.',
};

export const venueChangedNotice: EventNoticeViewModel = {
  type: 'venue_changed',
  title: 'Venue geändert',
  message: 'Das Event findet jetzt im Revier Südost statt.',
};

export const similarEvents: SimilarEventsViewModel = {
  title: 'Ähnliche Events',
  actionLabel: 'Mehr anzeigen',
  events: [clubNightEvent, soldOutFestivalEvent, hardTechnoEvent],
};

export const savedVoidEvent: SavedEventViewModel = {
  ...hardTechnoEvent,
  savedAtLabel: 'Gespeichert vor 2 Tagen',
  savedState: 'saved',
};

export const savedClubNight: SavedEventViewModel = {
  ...clubNightEvent,
  savedAtLabel: 'Gespeichert vor 4 Tagen',
  savedState: 'saved',
};

export const savedPastEvent: SavedEventViewModel = {
  ...soldOutFestivalEvent,
  savedAtLabel: 'Gespeichert vor 3 Wochen',
  savedState: 'past',
};

export const savedSection: SavedSectionViewModel = {
  title: '12 gespeicherte Events',
  count: 12,
  sortLabel: 'Neueste zuerst',
};

export const savedFilters: SavedFilterViewModel[] = [
  { id: 'all', label: 'Alle', selected: true, count: 12 },
  { id: 'upcoming', label: 'Bevorstehend', count: 8 },
  { id: 'past', label: 'Vergangen', count: 3 },
  { id: 'cancelled', label: 'Abgesagt', count: 1 },
];

export const savedSortOptions: SavedSortViewModel[] = [
  { id: 'saved_at', label: 'Neueste zuerst', selected: true },
  { id: 'date', label: 'Datum' },
  { id: 'distance', label: 'Entfernung' },
];

export const emptySaved: SavedEmptyViewModel = {
  variant: 'no_saved',
  title: 'Noch keine gespeicherten Events',
  description: 'Speichere Events, die du nicht verpassen willst.',
};

export const emptyPastSaved: SavedEmptyViewModel = {
  variant: 'no_past',
  title: 'Keine vergangenen Events',
};
