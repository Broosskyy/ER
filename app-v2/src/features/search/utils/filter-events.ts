import { DemoEvent } from '@/features/events/data/demo-events';

import {
  SEARCH_DEMO_REFERENCE_DATE,
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

export function matchesSearchQuery(event: DemoEvent, query: string): boolean {
  const terms = getQueryTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = buildEventSearchIndex(event);
  return terms.every((term) => haystack.includes(term));
}

export function matchesSearchGenre(event: DemoEvent, genreId: SearchGenreChipId): boolean {
  if (genreId === 'all') {
    return true;
  }

  const genreLabel = getSearchGenreLabel(genreId).toLowerCase();
  return event.genres.some((genre) => genre.toLowerCase() === genreLabel);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function matchesSearchSort(
  event: DemoEvent,
  sort: SearchSortOption,
  referenceDate: Date = SEARCH_DEMO_REFERENCE_DATE,
): boolean {
  if (sort === 'all') {
    return true;
  }

  const eventDate = new Date(event.startsAt);
  const referenceStart = startOfDay(referenceDate);

  if (sort === 'upcoming') {
    return eventDate >= referenceStart;
  }

  if (sort === 'this-week') {
    const weekEnd = endOfDay(addDays(referenceStart, 6));
    return eventDate >= referenceStart && eventDate <= weekEnd;
  }

  const monthEnd = endOfMonth(referenceStart);
  return eventDate >= referenceStart && eventDate <= monthEnd;
}

export function filterSearchEvents(
  events: DemoEvent[],
  query: string,
  genreId: SearchGenreChipId,
  sort: SearchSortOption,
): DemoEvent[] {
  return events
    .filter(
      (event) =>
        matchesSearchQuery(event, query) &&
        matchesSearchGenre(event, genreId) &&
        matchesSearchSort(event, sort),
    )
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}
