import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
function seriesKeyFromTitle(title: string): string | undefined {
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

export function buildEventSeriesGenreMap(events: StagingEventSnapshot[]): Map<string, string[]> {
  const seriesGenres = new Map<string, Set<string>>();
  for (const event of events) {
    const key = seriesKeyFromTitle(event.title);
    if (!key || event.genres.length === 0) {
      continue;
    }
    const bucket = seriesGenres.get(key) ?? new Set<string>();
    for (const genre of event.genres) {
      bucket.add(genre);
    }
    seriesGenres.set(key, bucket);
  }

  const byEventId = new Map<string, string[]>();
  for (const event of events) {
    const key = seriesKeyFromTitle(event.title);
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
