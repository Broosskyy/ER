import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  evaluateArtistCandidate,
  filterArtistCandidatesThroughGate,
} from '@/features/events/domain/artist-candidate-quality-gate';
import type { EventLineupEntryProjection } from '@/features/events/domain/event-lineup-entry-projection';
import { mapResolvedEntriesToProjections } from '@/features/events/domain/event-lineup-entry-projection';
import type { EventLineupArtist } from '@/features/events/domain/event-lineup';
import { lineupToArtistNames } from '@/data/mappers/event-lineup-mapper';

export type CanonicalLineupReadState = 'structured' | 'compatibility' | 'empty';

export interface CanonicalLineupReadResult {
  state: CanonicalLineupReadState;
  lineupEntries: EventLineupEntryProjection[];
  artistNames: string[];
  artistIds: string[];
}

function dedupeOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function sanitizeConsumerArtistNames(names: string[], eventTitle?: string): string[] {
  return filterArtistCandidatesThroughGate(names, {
    sourceField: 'lineup',
    extractionStrategy: 'structured',
    eventTitle,
  }).filter((name) => evaluateArtistCandidate({ name, sourceField: 'lineup' }).decision !== 'invalid');
}

function namesFromStructuredEntries(
  entries: ResolvedCanonicalLineupEntry[] | EventLineupEntryProjection[],
): string[] {
  const sorted = [...entries].sort((left, right) => left.order - right.order);
  const names: string[] = [];
  for (const entry of sorted) {
    for (const name of entry.artists) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Single canonical read order for all consumer surfaces.
 *
 * 1. structured lineup entries
 * 2. derived compatibility `event_artists`
 * 3. explicit empty lineup
 */
export function readCanonicalLineup(input: {
  structuredEntries?: ResolvedCanonicalLineupEntry[];
  compatibilityLineup?: EventLineupArtist[];
  eventTitle?: string;
}): CanonicalLineupReadResult {
  const structuredEntries = input.structuredEntries ?? [];

  if (structuredEntries.length > 0) {
    const lineupEntries = mapResolvedEntriesToProjections(structuredEntries)
      .map((entry) => ({
        ...entry,
        artists: sanitizeConsumerArtistNames(entry.artists, input.eventTitle),
      }))
      .filter((entry) => entry.artists.length > 0);
    const artistNames = sanitizeConsumerArtistNames(
      namesFromStructuredEntries(lineupEntries),
      input.eventTitle,
    );
    const allowedNames = new Set(artistNames.map((name) => name.toLowerCase()));
    const artistIds: string[] = [];
    const seenIds = new Set<string>();
    for (const entry of structuredEntries) {
      for (let index = 0; index < entry.artistIds.length; index += 1) {
        const artistId = entry.artistIds[index];
        const name = entry.artists[index]?.trim().toLowerCase();
        if (!artistId || !name || !allowedNames.has(name) || seenIds.has(artistId)) {
          continue;
        }
        seenIds.add(artistId);
        artistIds.push(artistId);
      }
    }
    return {
      state: 'structured',
      lineupEntries,
      artistNames,
      artistIds,
    };
  }

  const compatibilityLineup = input.compatibilityLineup ?? [];
  if (compatibilityLineup.length > 0) {
    const rawNames = lineupToArtistNames(compatibilityLineup);
    const artistNames = sanitizeConsumerArtistNames(rawNames, input.eventTitle);
    const allowedNames = new Set(artistNames.map((name) => name.toLowerCase()));
    const artistIds: string[] = [];
    const seenIds = new Set<string>();
    for (const entry of compatibilityLineup) {
      const name = entry.artist.name.trim();
      if (!allowedNames.has(name.toLowerCase())) {
        continue;
      }
      if (!entry.artist.id || seenIds.has(entry.artist.id)) {
        continue;
      }
      seenIds.add(entry.artist.id);
      artistIds.push(entry.artist.id);
    }

    if (artistNames.length === 0) {
      return {
        state: 'empty',
        lineupEntries: [],
        artistNames: [],
        artistIds: [],
      };
    }

    return {
      state: 'compatibility',
      lineupEntries: [],
      artistNames: dedupeOrdered(artistNames),
      artistIds: dedupeOrdered(artistIds),
    };
  }

  return {
    state: 'empty',
    lineupEntries: [],
    artistNames: [],
    artistIds: [],
  };
}

export function resolveKnownArtistNamesFromCanonical(input: {
  lineupEntries?: EventLineupEntryProjection[];
  lineup?: string[];
  artists: string[];
  eventTitle?: string;
}): string[] {
  if (input.lineupEntries && input.lineupEntries.length > 0) {
    return sanitizeConsumerArtistNames(
      namesFromStructuredEntries(input.lineupEntries),
      input.eventTitle,
    );
  }

  const merged = dedupeOrdered([...(input.lineup ?? []), ...input.artists]);
  return sanitizeConsumerArtistNames(merged, input.eventTitle);
}
