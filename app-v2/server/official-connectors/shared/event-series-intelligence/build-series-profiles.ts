import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { canonicalGenreKey, isWeakOnlyGenericGenre } from '../normalize-genre';
import { recoverPromoterEditorialGenresFromOfficialUrl } from '../promoter-editorial-genre-recovery';
import { matchEventSeriesIdentity } from './series-identity';
import type { EventSeriesGenreProfile } from './types';

export async function buildEventSeriesGenreProfiles(
  events: StagingEventSnapshot[],
): Promise<Map<string, EventSeriesGenreProfile>> {
  const profiles = new Map<string, EventSeriesGenreProfile>();
  const genreVotes = new Map<string, Map<string, number>>();
  const sourceUrls = new Map<string, Set<string>>();

  for (const event of events) {
    const identity = matchEventSeriesIdentity(event);
    if (!identity || identity.confidence === 'LOW') {
      continue;
    }
    const bucket = genreVotes.get(identity.seriesId) ?? new Map<string, number>();
    for (const genre of event.genres) {
      const key = canonicalGenreKey(genre);
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    genreVotes.set(identity.seriesId, bucket);
    const urls = sourceUrls.get(identity.seriesId) ?? new Set<string>();
    for (const source of event.sources) {
      if (source.sourceUrl) {
        urls.add(source.sourceUrl);
      }
    }
    sourceUrls.set(identity.seriesId, urls);
  }

  for (const event of events) {
    const identity = matchEventSeriesIdentity(event);
    if (!identity) {
      continue;
    }
    const officialUrl = event.sources.find((source) => /affenkaefig\.info|bootshaus\.tv/i.test(source.sourceUrl ?? ''))
      ?.sourceUrl;
    if (!officialUrl || profiles.has(identity.seriesId)) {
      continue;
    }
    let editorial: Awaited<ReturnType<typeof recoverPromoterEditorialGenresFromOfficialUrl>>;
    try {
      editorial = await recoverPromoterEditorialGenresFromOfficialUrl(officialUrl);
    } catch {
      continue;
    }
    if (editorial.genres.length === 0) {
      continue;
    }
    const now = new Date().toISOString();
    profiles.set(identity.seriesId, {
      seriesId: identity.seriesId,
      canonicalName: identity.canonicalName,
      aliases: [identity.canonicalName],
      genres: editorial.genres,
      evidence: editorial.genres.map((genre) => ({
        genreKey: canonicalGenreKey(genre),
        displayName: genre,
        sourceReference: editorial.sourceReference,
        classificationReason: editorial.classificationReason,
        confidence: identity.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM',
      })),
      confidence: identity.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM',
      sourceUrls: [editorial.sourceReference],
      observedAt: now,
      lastVerifiedAt: now,
    });
  }

  for (const [seriesId, votes] of genreVotes.entries()) {
    if (profiles.has(seriesId) || votes.size === 0) {
      continue;
    }
    const genres = [...votes.entries()]
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1])
      .map(([genreKey]) => genreKey);
    if (genres.length === 0) {
      continue;
    }
    const now = new Date().toISOString();
    profiles.set(seriesId, {
      seriesId,
      canonicalName: seriesId.replace('series:', ''),
      aliases: [],
      genres,
      evidence: genres.map((genre) => ({
        genreKey: genre,
        displayName: genre,
        sourceReference: 'classified_series_sibling',
        classificationReason: 'verified_series_sibling_genre_inheritance',
        confidence: 'MEDIUM',
      })),
      confidence: 'MEDIUM',
      sourceUrls: [...(sourceUrls.get(seriesId) ?? [])],
      observedAt: now,
      lastVerifiedAt: now,
    });
  }

  return profiles;
}

export function seriesGenresForEvent(
  event: StagingEventSnapshot,
  profiles: Map<string, EventSeriesGenreProfile>,
): string[] {
  const identity = matchEventSeriesIdentity(event);
  if (!identity || identity.confidence === 'LOW') {
    return [];
  }
  const profile = profiles.get(identity.seriesId);
  if (!profile || profile.genres.length === 0) {
    return [];
  }
  if (event.genres.length > 0 && !isWeakOnlyGenericGenre(event.genres)) {
    return [];
  }
  return profile.genres;
}
