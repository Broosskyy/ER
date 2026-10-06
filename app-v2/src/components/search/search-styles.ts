import type { AppIconName } from '@/components/primitives/AppIcon';

import type {
  DateFilterOption,
  SearchResultGroupKind,
  SearchSuggestionKind,
  SortOption,
} from './view-models';

const suggestionIcons: Record<SearchSuggestionKind, AppIconName> = {
  event: 'calendar-outline',
  city: 'location-outline',
  genre: 'musical-notes-outline',
  organizer: 'people-outline',
  club: 'business-outline',
  artist: 'mic-outline',
  venue: 'business-outline',
};

const sortLabels: Record<SortOption, string> = {
  distance: 'Entfernung',
  date: 'Datum',
  popularity: 'Beliebtheit',
  new: 'Neu',
};

const dateFilterLabels: Record<DateFilterOption, string> = {
  today: 'Heute',
  tomorrow: 'Morgen',
  weekend: 'Wochenende',
  date: 'Datum',
};

export function resolveSuggestionIcon(kind: SearchSuggestionKind): AppIconName {
  return suggestionIcons[kind];
}

export function resolveSortLabel(option: SortOption): string {
  return sortLabels[option];
}

export function resolveDateFilterLabel(option: DateFilterOption): string {
  return dateFilterLabels[option];
}

const groupTitles: Record<SearchResultGroupKind, string> = {
  events: 'Events',
  organizers: 'Veranstalter',
  venues: 'Venues',
  clubs: 'Clubs',
};

export function resolveSearchResultGroupTitle(kind: SearchResultGroupKind): string {
  return groupTitles[kind];
}
