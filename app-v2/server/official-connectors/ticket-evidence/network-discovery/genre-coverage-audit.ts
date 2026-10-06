import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { recoverBootshausGenresFromOfficialUrl } from '../../shared/bootshaus-genre-recovery';
import {
  canonicalGenreKey,
  isWeakOnlyGenericGenre,
  normalizeOfficialGenreLabels,
  normalizedGenresToExplicitLabels,
} from '../../shared/normalize-genre';
import type { EventGenreFusionResult } from '../../shared/discovery-genre-fusion/types';
import { loadStagingEventSnapshots, type StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import {
  auditGenreEvidenceForStaging,
  hasGenreConflict,
  type GenreEvidenceContext,
  type GenreEvidenceExhaustionResult,
} from '../../shared/genre-evidence';

export type GenreCoverageClassification =
  | 'GENRE_VERIFIED'
  | 'GENRE_RECOVERABLE'
  | 'GENRE_EVIDENCE_INCOMPLETE'
  | 'GENRE_UNRESOLVED_NO_EVIDENCE'
  | 'GENRE_CONFLICT_REVIEW';

export interface GenreCoverageEntry {
  eventId: string;
  title: string;
  sources: string[];
  currentGenres: string[];
  availableGenreEvidence: string[];
  evidenceStrength: 'strong' | 'weak' | 'none';
  recommendedGenres: string[];
  classification: GenreCoverageClassification;
  reason?: string;
  checkedLayers: string[];
  explicitGenreCount: number;
  lineupDerivedGenres: string[];
  confidenceBand: 'EXPLICIT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED';
}

function classifyGenreEntry(
  event: StagingEventSnapshot,
  exhaustion: GenreEvidenceExhaustionResult,
): GenreCoverageEntry {
  const sources = event.sources.map((source) => source.connectorId ?? source.sourceRole).filter(Boolean) as string[];
  const recommended = exhaustion.recommendedGenres;
  const available = [...new Set([...event.genres, ...recommended])];

  let classification: GenreCoverageClassification;
  let reason: string | undefined;
  let evidenceStrength: 'strong' | 'weak' | 'none' = 'none';
  let confidenceBand: GenreCoverageEntry['confidenceBand'] = 'UNRESOLVED';

  if (event.genres.length > 0 && hasGenreConflict(event.genres, recommended)) {
    classification = 'GENRE_CONFLICT_REVIEW';
    reason = 'current_genres_disagree_with_verified_evidence';
    evidenceStrength = 'strong';
    confidenceBand = 'HIGH';
  } else if (event.genres.length > 0) {
    const missingExplicit = recommended.filter(
      (genre) =>
        !event.genres.some((current) => canonicalGenreKey(current) === canonicalGenreKey(genre)),
    );
    if (missingExplicit.length > 0 && exhaustion.explicitGenreCount > 0) {
      classification = 'GENRE_EVIDENCE_INCOMPLETE';
      reason = 'explicit_genre_evidence_not_fully_canonicalized';
      evidenceStrength = 'strong';
      confidenceBand = 'EXPLICIT';
    } else if (missingExplicit.length > 0) {
      classification = 'GENRE_RECOVERABLE';
      reason = 'verified_genre_evidence_superset';
      evidenceStrength = 'strong';
      confidenceBand = exhaustion.explicitGenreCount > 0 ? 'EXPLICIT' : 'HIGH';
    } else {
      classification = 'GENRE_VERIFIED';
      evidenceStrength = event.genres.length > 0 ? 'strong' : 'weak';
      confidenceBand = exhaustion.explicitGenreCount > 0 ? 'EXPLICIT' : 'HIGH';
    }
  } else if (recommended.length > 0) {
    classification = 'GENRE_RECOVERABLE';
    reason = 'verified_evidence_after_exhaustion';
    evidenceStrength = 'strong';
    confidenceBand =
      exhaustion.explicitGenreCount > 0
        ? 'EXPLICIT'
        : exhaustion.lineupDerivedCount > 0
          ? 'HIGH'
          : 'HIGH';
  } else {
    classification = 'GENRE_UNRESOLVED_NO_EVIDENCE';
    reason =
      exhaustion.checkedLayers.length > 0
        ? 'evidence_layers_exhausted_without_genre'
        : 'no_verified_genre_evidence_available';
    confidenceBand = 'UNRESOLVED';
  }

  return {
    eventId: event.eventId,
    title: event.title,
    sources,
    currentGenres: event.genres,
    availableGenreEvidence: available,
    evidenceStrength,
    recommendedGenres: recommended,
    classification,
    reason,
    checkedLayers: exhaustion.checkedLayers,
    explicitGenreCount: exhaustion.explicitGenreCount,
    lineupDerivedGenres: exhaustion.lineupDerivedGenres,
    confidenceBand,
  };
}

export function auditGenreCoverage(
  runQuery: LinkedQueryExecutor,
  context?: GenreEvidenceContext,
): GenreCoverageEntry[] {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const exhaustions = auditGenreEvidenceForStaging(runQuery, events, context);
  return events.map((event, index) => classifyGenreEntry(event, exhaustions[index]!));
}

export async function repairBootshausMissingGenres(
  runQuery: LinkedQueryExecutor,
  entries: GenreCoverageEntry[],
  events: StagingEventSnapshot[],
): Promise<number> {
  let repaired = 0;
  const unresolved = entries.filter((entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE');
  for (const entry of unresolved) {
    const event = events.find((item) => item.eventId === entry.eventId);
    const bootshausUrl = event?.sources.find(
      (source) => /bootshaus\.tv\/events\//i.test(source.sourceUrl ?? ''),
    )?.sourceUrl;
    if (!bootshausUrl) {
      continue;
    }
    const recovered = await recoverBootshausGenresFromOfficialUrl(bootshausUrl);
    if (recovered.length === 0) {
      continue;
    }
    runQuery(`DELETE FROM public.event_genres WHERE event_id = '${entry.eventId}'::uuid;`);
    const normalized = normalizeOfficialGenreLabels(recovered);
    for (const [index, label] of normalizedGenresToExplicitLabels(normalized.normalized).entries()) {
      const genreKey =
        normalized.normalized.find((genre) => genre.displayName === label)?.genreKey ??
        canonicalGenreKey(label);
      runQuery(
        `INSERT INTO public.event_genres (event_id, genre_key, display_name, sort_order)
         VALUES ('${entry.eventId}'::uuid, '${genreKey.replace(/'/g, "''")}', '${label.replace(/'/g, "''")}', ${index});`,
      );
    }
    repaired += 1;
  }
  return repaired;
}

export function writeEventGenres(runQuery: LinkedQueryExecutor, eventId: string, genres: string[]): void {
  runQuery(`DELETE FROM public.event_genres WHERE event_id = '${eventId}'::uuid;`);
  const normalized = normalizeOfficialGenreLabels(genres);
  for (const [index, label] of normalizedGenresToExplicitLabels(normalized.normalized).entries()) {
    const genreKey =
      normalized.normalized.find((genre) => genre.displayName === label)?.genreKey ??
      canonicalGenreKey(label);
    runQuery(
      `INSERT INTO public.event_genres (event_id, genre_key, display_name, sort_order)
       VALUES ('${eventId}'::uuid, '${genreKey.replace(/'/g, "''")}', '${label.replace(/'/g, "''")}', ${index});`,
    );
  }
}

export function shouldRepairGenreFromFusion(
  currentGenres: string[],
  recommendedGenres: string[],
  changedFromCurrent: boolean,
): boolean {
  if (recommendedGenres.length === 0) {
    return false;
  }
  if (currentGenres.length === 0) {
    return true;
  }
  if (isWeakOnlyGenericGenre(currentGenres) && changedFromCurrent) {
    return true;
  }
  return false;
}

export function repairRecoverableGenres(
  runQuery: LinkedQueryExecutor,
  entries: GenreCoverageEntry[],
): number {
  let repaired = 0;
  for (const entry of entries.filter(
    (item) => item.classification === 'GENRE_RECOVERABLE' || item.classification === 'GENRE_EVIDENCE_INCOMPLETE',
  )) {
    writeEventGenres(runQuery, entry.eventId, entry.recommendedGenres);
    repaired += 1;
  }
  return repaired;
}

export function repairFusionGenrePlans(
  runQuery: LinkedQueryExecutor,
  fusionResults: EventGenreFusionResult[],
  events: StagingEventSnapshot[],
): number {
  let repaired = 0;
  const eventsById = new Map(events.map((event) => [event.eventId, event]));
  for (const result of fusionResults) {
    const event = eventsById.get(result.eventId);
    if (!event) {
      continue;
    }
    if (
      !shouldRepairGenreFromFusion(event.genres, result.recommendedGenres, result.changedFromCurrent)
    ) {
      continue;
    }
    writeEventGenres(runQuery, result.eventId, result.recommendedGenres);
    repaired += 1;
  }
  return repaired;
}
