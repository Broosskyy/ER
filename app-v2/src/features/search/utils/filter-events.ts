import {
  EVENT_REFERENCE_DATE,
  isThisMonthEvent,
  isThisWeekEvent,
  isUpcomingEvent,
  type Event,
} from '@/features/events';

import {
  SearchGenreChipId,
  SearchSortOption,
  buildEventSearchIndex,
  getSearchGenreLabel,
} from '../constants';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function getQueryTerms(query: string): string[] {
  return normalizeQuery(query).split(/\s+/).filter(Boolean);
}

export function matchesSearchQuery(event: Event, query: string): boolean {
  const terms = getQueryTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = buildEventSearchIndex(event);
  return terms.every((term) => haystack.includes(term));
}

export function matchesSearchGenre(event: Event, genreId: SearchGenreChipId): boolean {
  if (genreId === 'all') {
    return true;
  }

  const genreLabel = getSearchGenreLabel(genreId).toLowerCase();
  return event.genres.some((genre) => genre.toLowerCase() === genreLabel);
}

export function matchesSearchSort(
  event: Event,
  sort: SearchSortOption,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  if (sort === 'all') {
    return true;
  }

  if (sort === 'upcoming') {
    return isUpcomingEvent(event, referenceDate);
  }

  if (sort === 'this-week') {
    return isThisWeekEvent(event, referenceDate);
  }

  return isThisMonthEvent(event, referenceDate);
}

export function filterSearchEvents(
  events: Event[],
  query: string,
  genreId: SearchGenreChipId,
  sort: SearchSortOption,
): Event[] {
  return events
    .filter(
      (event) =>
        matchesSearchQuery(event, query) &&
        matchesSearchGenre(event, genreId) &&
        matchesSearchSort(event, sort),
    )
    .sort((left, right) => left.startDateTime.localeCompare(right.startDateTime));
}
