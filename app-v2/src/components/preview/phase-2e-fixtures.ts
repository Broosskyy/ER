import { hardTechnoEvent, clubNightEvent } from '@/components/discovery/preview-fixtures';
import type { EventListItemViewModel } from '@/components/discovery/view-models';
import type {
  ActiveFilterViewModel,
  ArtistFilterViewModel,
  CityFilterViewModel,
  DateFilterViewModel,
  DistanceFilterViewModel,
  GenreFilterViewModel,
  OrganizerFilterViewModel,
  PriceFilterViewModel,
  RecentSearchViewModel,
  SearchResultGroupViewModel,
  SearchSuggestionViewModel,
  SortViewModel,
  TrendingSearchViewModel,
  VenueFilterViewModel,
} from '@/components/search/view-models';

export const previewSuggestions: SearchSuggestionViewModel[] = [
  {
    id: 's-void',
    kind: 'event',
    title: 'VOID: Techno Saturday',
    subtitleLabel: 'Sisyphos · Berlin',
    accessibilityLabel: 'Event-Vorschlag VOID Techno Saturday',
  },
  {
    id: 's-berlin',
    kind: 'city',
    title: 'Berlin',
    subtitleLabel: 'Deutschland',
    accessibilityLabel: 'Stadt-Vorschlag Berlin',
  },
  {
    id: 's-techno',
    kind: 'genre',
    title: 'Techno',
    subtitleLabel: 'Genre',
    badgeLabel: 'Beliebt',
    accessibilityLabel: 'Genre-Vorschlag Techno',
  },
  {
    id: 's-void-org',
    kind: 'organizer',
    title: 'VOID Collective',
    subtitleLabel: 'Veranstalter',
    accessibilityLabel: 'Veranstalter-Vorschlag VOID Collective',
  },
  {
    id: 's-sisyphos',
    kind: 'club',
    title: 'Sisyphos',
    subtitleLabel: 'Club · Berlin',
    accessibilityLabel: 'Club-Vorschlag Sisyphos',
  },
];

export const previewRecentSearches: RecentSearchViewModel[] = [
  {
    id: 'r-techno',
    title: 'Techno Berlin',
    subtitleLabel: '3 Filter aktiv',
    accessibilityLabel: 'Letzte Suche Techno Berlin',
  },
  {
    id: 'r-weekend',
    title: 'Dieses Wochenende',
    accessibilityLabel: 'Letzte Suche Dieses Wochenende',
  },
];

export const previewTrendingSearches: TrendingSearchViewModel[] = [
  {
    id: 't-hard',
    title: 'Hard Techno',
    badgeLabel: 'Hot',
    trendLabel: '+24 % diese Woche',
    rank: 1,
    accessibilityLabel: 'Trending Hard Techno',
  },
  {
    id: 't-warehouse',
    title: 'Warehouse Rave',
    trendLabel: 'Beliebt in Köln',
    accessibilityLabel: 'Trending Warehouse Rave',
  },
];

export const previewGenreFilters: GenreFilterViewModel[] = [
  { id: 'all', label: 'Alle' },
  { id: 'techno', label: 'Techno', selected: true },
  { id: 'house', label: 'House' },
  { id: 'hard-techno', label: 'Hard Techno', selected: true },
];

export const previewDateFilters: DateFilterViewModel[] = [
  { id: 'today', label: 'Heute' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'weekend', label: 'Wochenende', selected: true },
  { id: 'date', label: 'Datum' },
];

export const previewPriceFilters: PriceFilterViewModel[] = [
  { id: 'free', label: 'Kostenlos' },
  { id: 'under-20', label: 'Bis 20 €', selected: true },
  { id: '20-50', label: '20–50 €' },
  { id: '50-plus', label: '50 €+' },
];

export const previewDistanceFilters: DistanceFilterViewModel[] = [
  { id: '5', label: '5 km', selected: true },
  { id: '25', label: '25 km' },
  { id: 'any', label: 'Beliebig' },
];

export const previewCityFilters: CityFilterViewModel[] = [
  { id: 'berlin', cityLabel: 'Berlin, Germany', selected: true },
  { id: 'koeln', cityLabel: 'Köln, Germany' },
];

export const previewVenueFilters: VenueFilterViewModel[] = [
  { id: 'sisyphos', label: 'Sisyphos' },
  { id: 'berghain', label: 'Berghain', selected: true },
  { id: 'about-blank', label: '//about blank' },
];

export const previewOrganizerFilters: OrganizerFilterViewModel[] = [
  { id: 'void', label: 'VOID', selected: true },
  { id: 'fckng', label: 'FCKNG SERIOUS' },
];

export const previewArtistFilters: ArtistFilterViewModel[] = [
  { id: 'klang', label: 'Klangkuenstler' },
  { id: 'dax', label: 'Dax J' },
];

export const previewSortOptions: SortViewModel[] = [
  { id: 'distance', label: 'Entfernung' },
  { id: 'date', label: 'Datum', selected: true },
  { id: 'popularity', label: 'Beliebtheit' },
  { id: 'new', label: 'Neu' },
];

export const previewActiveFilters: ActiveFilterViewModel[] = [
  { id: 'genre-techno', label: 'Techno' },
  { id: 'date-weekend', label: 'Wochenende' },
  { id: 'city-berlin', label: 'Berlin' },
  { id: 'price-under-20', label: 'Bis 20 €' },
];

export const previewEventGroup: SearchResultGroupViewModel = {
  kind: 'events',
  title: 'Events',
  count: 128,
  actionLabel: 'Mehr anzeigen',
};

export const previewEventResults: EventListItemViewModel[] = [
  {
    id: hardTechnoEvent.id,
    title: hardTechnoEvent.title,
    dateLabel: hardTechnoEvent.dateLabel,
    timeLabel: hardTechnoEvent.timeLabel,
    venueLabel: hardTechnoEvent.venueLabel,
    cityLabel: hardTechnoEvent.cityLabel,
    genreLabels: hardTechnoEvent.genreLabels,
    status: hardTechnoEvent.status,
    accessibilityLabel: hardTechnoEvent.accessibilityLabel,
  },
  {
    id: clubNightEvent.id,
    title: clubNightEvent.title,
    dateLabel: clubNightEvent.dateLabel,
    timeLabel: clubNightEvent.timeLabel,
    venueLabel: clubNightEvent.venueLabel,
    cityLabel: clubNightEvent.cityLabel,
    genreLabels: clubNightEvent.genreLabels,
    status: clubNightEvent.status,
    accessibilityLabel: clubNightEvent.accessibilityLabel,
  },
];
