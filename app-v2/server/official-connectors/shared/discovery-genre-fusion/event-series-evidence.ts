import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { EventSeriesGenreProfile } from '../event-series-intelligence/types';
import { seriesGenresForEvent } from '../event-series-intelligence/build-series-profiles';
import { matchEventSeriesIdentity } from '../event-series-intelligence/series-identity';
import { isWeakOnlyGenericGenre } from '../normalize-genre';

function legacySeriesKeyFromTitle(title: string): string | undefined {
  const normalized = title.toLowerCase();
  if (/kit\s*kat|kitkat/i.test(normalized)) {
    return 'series:kitkat';
  }
  if (/\baffenk[äa]fig\b/i.test(normalized)) {
    return 'series:affenkaefig';
  }
  if (/\bbootshaus on a ship\b/i.test(normalized)) {
    return 'series:bootshaus-ship';
  }
  if (/\bmdma\b/i.test(normalized) && /\bbootshaus\b/i.test(normalized)) {
    return 'series:bootshaus-mdma';
  }
  if (/\bhalloween\b/i.test(normalized)) {
    return 'series:halloween';
  }
  return undefined;
}

export function buildEventSeriesGenreMap(
  events: StagingEventSnapshot[],
  seriesProfiles?: Map<string, EventSeriesGenreProfile>,
): Map<string, string[]> {
  const byEventId = new Map<string, string[]>();

  if (seriesProfiles && seriesProfiles.size > 0) {
    for (const event of events) {
      const genres = seriesGenresForEvent(event, seriesProfiles);
      if (genres.length > 0) {
        byEventId.set(event.eventId, genres);
      }
    }
  }

  const seriesGenres = new Map<string, Set<string>>();
  for (const event of events) {
    const key = matchEventSeriesIdentity(event)?.seriesId ?? legacySeriesKeyFromTitle(event.title);
    if (!key || event.genres.length === 0 || isWeakOnlyGenericGenre(event.genres)) {
      continue;
    }
    const bucket = seriesGenres.get(key) ?? new Set<string>();
    for (const genre of event.genres) {
      bucket.add(genre);
    }
    seriesGenres.set(key, bucket);
  }

  for (const event of events) {
    if (byEventId.has(event.eventId)) {
      continue;
    }
    const key = matchEventSeriesIdentity(event)?.seriesId ?? legacySeriesKeyFromTitle(event.title);
    if (!key) {
      continue;
    }
    const genres = seriesGenres.get(key);
    if (!genres || genres.size === 0) {
      continue;
    }
    byEventId.set(event.eventId, [...genres]);
  }

  return byEventId;
}
