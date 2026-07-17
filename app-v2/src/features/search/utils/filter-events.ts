import type { Event } from '@/features/events';

import {
  ExploreTimeFilterId,
  SearchGenreChipId,
  buildEventSearchIndex,
  getSearchGenreLabel,
  matchesExploreTimeFilter,
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

export function filterSearchEvents(
  events: Event[],
  query: string,
  genreId: SearchGenreChipId,
  timeFilter: ExploreTimeFilterId,
): Event[] {
  return events
    .filter(
      (event) =>
        matchesSearchQuery(event, query) &&
        matchesSearchGenre(event, genreId) &&
        matchesExploreTimeFilter(event, timeFilter),
    )
    .sort((left, right) => left.startDateTime.localeCompare(right.startDateTime));
}

export function filterExploreEvents(
  events: Event[],
  genreId: SearchGenreChipId,
  timeFilter: ExploreTimeFilterId,
): Event[] {
  return filterSearchEvents(events, '', genreId, timeFilter);
}
