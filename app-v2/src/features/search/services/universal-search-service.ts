import { normalizeDiscoverySearchText, tokenizeDiscoverySearchText } from '@/features/discovery/search/discovery-search-normalizer';
import { matchesDiscoverySearch } from '@/features/discovery/search/discovery-search-matcher';
import { getActiveCityOptions, getActiveGenreOptions } from '@/features/search/config/filter-config';
import type { EventFilters } from '@/features/search/constants';
import { discoveryCitiesMatch } from '@/features/location/normalize-discovery-city';
import type { Event } from '@/features/events/types/event';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  isInternalEntityId,
  isInternalPublicEvent,
} from '@/features/events/discovery/internal-event-eligibility';
import { resolveEntityProfileRoute } from '@/features/profiles/routes/entity-profile-routes';

import type {
  UniversalSearchEntityReaders,
  UniversalSearchGroupedResults,
  UniversalSearchResult,
} from '../domain/universal-search-types';
import { resolveEffectiveLocationScope } from '../domain/location-scope';
import { getActiveFilterSummaries } from '../utils/filter-events';

const ENTITY_RESULT_LIMIT = 6;
/** Short queries need a stronger signal than a single weak substring hit. */
const SHORT_QUERY_MIN_SCORE = 20;
const SHORT_QUERY_MAX_LENGTH = 2;
const DESCRIPTION_MATCH_WEIGHT = 0.45;

function isInternalEvent(event: Event): boolean {
  return isInternalPublicEvent(event);
}

function scoreEventMatch(query: string, event: Event): number {
  const titleScore = scoreTextMatch(query, event.title) * 2;
  const artistScore = scoreTextMatch(query, event.artists.join(' ')) * 1.5;
  const venueScore = scoreTextMatch(query, event.venue, event.city) * 1.25;
  const organizerScore = scoreTextMatch(query, event.organizer) * 1.1;
  const genreScore = scoreTextMatch(query, event.genres.join(' '));
  const descriptionScore = scoreTextMatch(query, event.description) * DESCRIPTION_MATCH_WEIGHT;

  return titleScore + artistScore + venueScore + organizerScore + genreScore + descriptionScore;
}

export function scoreTextMatch(query: string, ...candidates: Array<string | undefined>): number {
  const terms = tokenizeDiscoverySearchText(query, 'de');
  if (terms.length === 0) {
    return 0;
  }

  const normalizedQuery = normalizeDiscoverySearchText(query, 'de');
  const normalizedCandidates = candidates
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => normalizeDiscoverySearchText(value, 'de'));

  if (normalizedCandidates.length === 0) {
    return 0;
  }

  let score = 0;

  for (const candidate of normalizedCandidates) {
    if (candidate === normalizedQuery) {
      score += 40;
      continue;
    }
    if (candidate.startsWith(normalizedQuery)) {
      score += 30;
      continue;
    }
    if (candidate.includes(normalizedQuery)) {
      score += 18;
    }
  }

  const haystack = normalizedCandidates.join(' ');
  for (const term of terms) {
    if (haystack.includes(term)) {
      score += 10;
    }
  }

  if (normalizedQuery.length <= SHORT_QUERY_MAX_LENGTH && score < SHORT_QUERY_MIN_SCORE) {
    return 0;
  }

  return score;
}

function buildEntityResult(
  resultType: UniversalSearchResult['resultType'],
  entity: { id: string; title: string; subtitle?: string; imageUrl?: string; route?: string },
  query: string,
  relatedEventCount?: number,
): UniversalSearchResult | null {
  if (isInternalEntityId(entity.id)) {
    return null;
  }

  const relevanceScore = scoreTextMatch(query, entity.title, entity.subtitle);
  if (relevanceScore <= 0) {
    return null;
  }

  return {
    resultType,
    id: entity.id,
    title: entity.title,
    subtitle: entity.subtitle,
    imageUrl: entity.imageUrl,
    relevanceScore,
    matchedFields: [{ field: 'name', value: entity.title }],
    relatedEventCount,
    route: entity.route,
  };
}

function countRelatedEvents(events: Event[], matcher: (event: Event) => boolean): number {
  return events.filter(matcher).length;
}

function dedupeEvents(events: EventDisplayModel[]): EventDisplayModel[] {
  const seen = new Set<string>();
  const deduped: EventDisplayModel[] = [];

  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    deduped.push(event);
  }

  return deduped;
}

function filterEventsForScope(events: Event[], filters: EventFilters): Event[] {
  const scope = resolveEffectiveLocationScope(filters);
  if (scope === 'global' || !filters.city.trim()) {
    return events.filter((event) => !isInternalEvent(event));
  }

  return events.filter(
    (event) => !isInternalEvent(event) && discoveryCitiesMatch(filters.city, event.city),
  );
}

export async function buildUniversalSearchResults(input: {
  query: string;
  filters: EventFilters;
  events: EventDisplayModel[];
  sourceEvents: Event[];
  totalEventMatches: number;
  hasMoreEvents: boolean;
  entityReaders: UniversalSearchEntityReaders;
}): Promise<UniversalSearchGroupedResults> {
  const normalizedQuery = input.query.trim();
  const scopedSourceEvents = filterEventsForScope(input.sourceEvents, input.filters);
  const publicDisplayEvents = input.events.filter((event) => !isInternalEntityId(event.id));

  const [artists, venues, organizers] = await Promise.all([
    input.entityReaders.listPublishedArtists(),
    input.entityReaders.listVenues(),
    input.entityReaders.listOrganizers(),
  ]);

  const artistResults = artists
    .map((artist) =>
      buildEntityResult(
        'ARTIST',
        {
          id: artist.id,
          title: artist.name,
          subtitle: artist.city,
          imageUrl: artist.imageUrl,
          route: resolveEntityProfileRoute('artist', artist.slug || artist.id),
        },
        normalizedQuery,
        countRelatedEvents(scopedSourceEvents, (event) =>
          event.artists.some((name) => scoreTextMatch(artist.name, name) > 0),
        ),
      ),
    )
    .filter((result): result is UniversalSearchResult => result !== null)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, ENTITY_RESULT_LIMIT);

  const venueResults = venues
    .map((venue) =>
      buildEntityResult(
        'VENUE',
        {
          id: venue.id,
          title: venue.name,
          subtitle: venue.city,
          route: resolveEntityProfileRoute('venue', venue.slug || venue.id),
        },
        normalizedQuery,
        countRelatedEvents(scopedSourceEvents, (event) =>
          event.venueId === venue.id || scoreTextMatch(venue.name, event.venue) > 0,
        ),
      ),
    )
    .filter((result): result is UniversalSearchResult => result !== null)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, ENTITY_RESULT_LIMIT);

  const organizerResults = organizers
    .map((organizer) =>
      buildEntityResult(
        'ORGANIZER',
        {
          id: organizer.id,
          title: organizer.name,
          subtitle: organizer.city,
          imageUrl: organizer.logoUrl,
          route: resolveEntityProfileRoute('organizer', organizer.slug || organizer.id),
        },
        normalizedQuery,
        countRelatedEvents(scopedSourceEvents, (event) =>
          event.organizerId === organizer.id || scoreTextMatch(organizer.name, event.organizer) > 0,
        ),
      ),
    )
    .filter((result): result is UniversalSearchResult => result !== null)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, ENTITY_RESULT_LIMIT);

  const catalogueCities = getActiveCityOptions().map((city) => ({
    id: city.id,
    title: city.label,
    value: city.value,
  }));
  const eventCities = scopedSourceEvents
    .map((event) => event.city?.trim())
    .filter((city): city is string => Boolean(city))
    .filter(
      (city, index, all) =>
        all.findIndex((candidate) => discoveryCitiesMatch(candidate, city)) === index,
    )
    .map((city) => ({
      id: `city-${normalizeDiscoverySearchText(city, 'de')}`,
      title: city,
      value: city,
    }));
  const cityCandidates = [...catalogueCities];
  for (const city of eventCities) {
    if (!cityCandidates.some((candidate) => discoveryCitiesMatch(candidate.value, city.value))) {
      cityCandidates.push(city);
    }
  }

  const cityResults = cityCandidates
    .map((city) =>
      buildEntityResult(
        'CITY',
        {
          id: city.id,
          title: city.title,
          subtitle: 'Stadt',
          route: `/(tabs)/search?query=${encodeURIComponent(city.title)}`,
        },
        normalizedQuery,
        countRelatedEvents(scopedSourceEvents, (event) => discoveryCitiesMatch(city.value, event.city)),
      ),
    )
    .filter((result): result is UniversalSearchResult => result !== null)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, ENTITY_RESULT_LIMIT);

  const genreResults = getActiveGenreOptions()
    .map((genre) =>
      buildEntityResult(
        'GENRE',
        {
          id: genre.id,
          title: genre.label,
          subtitle: 'Genre',
          route: `/(tabs)/search?query=${encodeURIComponent(genre.label)}`,
        },
        normalizedQuery,
        countRelatedEvents(scopedSourceEvents, (event) =>
          event.genres.some((label) => scoreTextMatch(genre.label, label) > 0),
        ),
      ),
    )
    .filter((result): result is UniversalSearchResult => result !== null)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, ENTITY_RESULT_LIMIT);

  const relationshipEvents = scopedSourceEvents
    .filter((event) => {
      if (matchesDiscoverySearch(event, normalizedQuery)) {
        return true;
      }

      const descriptionScore = scoreTextMatch(normalizedQuery, event.description) * DESCRIPTION_MATCH_WEIGHT;
      if (descriptionScore >= SHORT_QUERY_MIN_SCORE) {
        return true;
      }

      return (
        artistResults.some((artist) =>
          event.artists.some((name) => scoreTextMatch(artist.title, name) > 0),
        ) ||
        venueResults.some(
          (venue) => event.venueId === venue.id || scoreTextMatch(venue.title, event.venue) > 0,
        ) ||
        organizerResults.some(
          (organizer) =>
            event.organizerId === organizer.id ||
            scoreTextMatch(organizer.title, event.organizer) > 0,
        ) ||
        cityResults.some((city) => discoveryCitiesMatch(city.title, event.city)) ||
        genreResults.some((genre) =>
          event.genres.some((label) => scoreTextMatch(genre.title, label) > 0),
        )
      );
    })
    .map((event) => publicDisplayEvents.find((display) => display.id === event.id))
    .filter((event): event is EventDisplayModel => Boolean(event));

  const mergedEvents = dedupeEvents([...publicDisplayEvents, ...relationshipEvents]).sort((left, right) => {
    const leftSource = input.sourceEvents.find((event) => event.id === left.id);
    const rightSource = input.sourceEvents.find((event) => event.id === right.id);
    const leftScore = leftSource ? scoreEventMatch(normalizedQuery, leftSource) : 0;
    const rightScore = rightSource ? scoreEventMatch(normalizedQuery, rightSource) : 0;
    return rightScore - leftScore;
  });

  return {
    scope: resolveEffectiveLocationScope(input.filters),
    appliedFilters: getActiveFilterSummaries(input.filters),
    query: normalizedQuery,
    totalEventMatches: Math.max(input.totalEventMatches, mergedEvents.length),
    events: mergedEvents,
    artists: artistResults,
    venues: venueResults,
    organizers: organizerResults,
    cities: cityResults,
    genres: genreResults,
    hasMoreEvents: input.hasMoreEvents,
  };
}
