import type {
  EventCardViewModel,
  EventListItemViewModel,
  LineupItemViewModel,
  OrganizerListItemViewModel,
  SearchResultItemViewModel,
  VenueListItemViewModel,
} from './view-models';

export const hardTechnoEvent: EventCardViewModel = {
  id: 'void-techno-saturday',
  title: 'VOID: Techno Saturday',
  dateLabel: '24 MAI',
  weekdayLabel: 'SA',
  timeLabel: '23:00',
  venueLabel: 'Sisyphos',
  cityLabel: 'Berlin',
  genreLabels: ['Techno', 'Hard Techno'],
  categoryLabel: 'Techno',
  organizerLabel: 'VOID',
  ticketLabel: 'Ab 15,00 €',
  ticketStatus: 'available',
  status: 'upcoming',
  verified: true,
  accessibilityLabel: 'VOID: Techno Saturday at Sisyphos, Berlin',
};

export const clubNightEvent: EventCardViewModel = {
  id: 'fckng-serious',
  title: 'FCKNG SERIOUS',
  dateLabel: '24 MAI',
  weekdayLabel: 'SA',
  timeLabel: '23:30',
  venueLabel: '//about blank',
  cityLabel: 'Berlin',
  genreLabels: ['Techno', 'Industrial'],
  categoryLabel: 'Industrial',
  ticketLabel: 'Ab 20,00 €',
  ticketStatus: 'limited',
  status: 'today',
  accessibilityLabel: 'FCKNG SERIOUS at about blank, Berlin',
};

export const soldOutFestivalEvent: EventCardViewModel = {
  id: 'klangkuenstler-berghain',
  title: 'Klangkuenstler presents ALL NIGHT LONG',
  dateLabel: '31 MAI',
  weekdayLabel: 'SA',
  timeLabel: '22:00',
  venueLabel: 'Berghain',
  cityLabel: 'Berlin',
  genreLabels: ['Hard Techno', 'Live Act'],
  categoryLabel: 'Hard Techno',
  ticketStatus: 'sold_out',
  status: 'sold_out',
  accessibilityLabel: 'Sold out Klangkuenstler event at Berghain, Berlin',
};

export const cancelledEvent: EventCardViewModel = {
  id: 'warehouse-cancelled',
  title: 'Warehouse Rave: Summer Closing',
  dateLabel: '07 JUN',
  weekdayLabel: 'SA',
  timeLabel: '22:00',
  venueLabel: 'Kraftwerk Mitte',
  cityLabel: 'Dresden',
  genreLabels: ['House', 'Techno'],
  categoryLabel: 'House',
  status: 'cancelled',
  accessibilityLabel: 'Cancelled Warehouse Rave in Dresden',
};

export const postponedEvent: EventCardViewModel = {
  id: 'festival-postponed',
  title: 'Rheinland Open Air Festival 2026',
  dateLabel: '12 JUL',
  weekdayLabel: 'SA',
  timeLabel: '16:00',
  venueLabel: 'Rheinpark',
  cityLabel: 'Köln',
  genreLabels: ['Festival', 'Open Air'],
  categoryLabel: 'Festival',
  ticketStatus: 'free',
  status: 'postponed',
  accessibilityLabel: 'Postponed Rheinland Open Air Festival in Köln',
};

export const longTitleEvent: EventCardViewModel = {
  ...hardTechnoEvent,
  id: 'long-title',
  title: 'A Night of Relentless Industrial Techno with Special Guests and Extended Closing Set',
  venueLabel: 'Ehemaliges Heizkraftwerk am Rande des Industriehafens',
  cityLabel: 'Duisburg',
  accessibilityLabel: 'Long title industrial techno event in Duisburg',
};

export const compactListEvents: EventListItemViewModel[] = [
  {
    id: hardTechnoEvent.id,
    title: hardTechnoEvent.title,
    image: hardTechnoEvent.image,
    dateLabel: hardTechnoEvent.dateLabel,
    timeLabel: hardTechnoEvent.timeLabel,
    venueLabel: hardTechnoEvent.venueLabel,
    cityLabel: hardTechnoEvent.cityLabel,
    genreLabels: hardTechnoEvent.genreLabels,
    accessibilityLabel: hardTechnoEvent.accessibilityLabel,
  },
  {
    id: longTitleEvent.id,
    title: longTitleEvent.title,
    dateLabel: longTitleEvent.dateLabel,
    timeLabel: longTitleEvent.timeLabel,
    venueLabel: longTitleEvent.venueLabel,
    cityLabel: longTitleEvent.cityLabel,
    genreLabels: longTitleEvent.genreLabels,
    status: 'postponed',
    accessibilityLabel: longTitleEvent.accessibilityLabel,
  },
];

export const previewVenue: VenueListItemViewModel = {
  id: 'sisyphos',
  name: 'Sisyphos',
  cityLabel: 'Berlin',
  subtitleLabel: 'Hauptstraße 15, 10317 Berlin',
  verified: true,
  accessibilityLabel: 'Sisyphos, Berlin',
};

export const previewOrganizer: OrganizerListItemViewModel = {
  id: 'rave-united',
  name: 'Rave United',
  typeLabel: 'Organizer',
  subtitleLabel: 'Berlin, Deutschland · raveunited.com',
  verified: true,
  accessibilityLabel: 'Verified organizer Rave United',
};

export const previewLineupItem: LineupItemViewModel = {
  name: 'Sara Landry',
  headliner: true,
  subtitleLabel: 'Hard Techno',
  accessibilityLabel: 'Sara Landry, Headliner',
};

export const previewSearchResult: SearchResultItemViewModel = {
  kind: 'event',
  id: hardTechnoEvent.id,
  title: hardTechnoEvent.title,
  image: hardTechnoEvent.image,
  dateLabel: hardTechnoEvent.dateLabel,
  timeLabel: hardTechnoEvent.timeLabel,
  venueLabel: hardTechnoEvent.venueLabel,
  cityLabel: hardTechnoEvent.cityLabel,
  genreLabels: hardTechnoEvent.genreLabels,
  accessibilityLabel: hardTechnoEvent.accessibilityLabel,
};
