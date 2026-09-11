import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { parseDescriptionExplicitGenres } from '../../shared/parse-description-genres';
import { normalizeOfficialGenreLabels, normalizedGenresToExplicitLabels } from '../../shared/normalize-genre';
import { loadStagingEventSnapshots, type StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';

export type GenreCoverageClassification =
  | 'GENRE_VERIFIED'
  | 'GENRE_RECOVERABLE'
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
}

function collectGenreEvidence(event: StagingEventSnapshot): string[] {
  const labels = new Set<string>(event.genres);
  for (const label of parseDescriptionExplicitGenres(event.description ?? undefined)) {
    labels.add(label);
  }
  return [...labels];
}

export function auditGenreCoverage(runQuery: LinkedQueryExecutor): GenreCoverageEntry[] {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  return events.map((event) => {
    const available = collectGenreEvidence(event);
    const recommended = normalizedGenresToExplicitLabels(normalizeOfficialGenreLabels(available).normalized);
    const sources = event.sources.map((source) => source.connectorId ?? source.sourceRole).filter(Boolean) as string[];

    if (event.genres.length > 0 && recommended.length > 0) {
      return {
        eventId: event.eventId,
        title: event.title,
        sources,
        currentGenres: event.genres,
        availableGenreEvidence: available,
        evidenceStrength: 'strong',
        recommendedGenres: recommended,
        classification: 'GENRE_VERIFIED',
      };
    }

    if (event.genres.length === 0 && recommended.length > 0) {
      return {
        eventId: event.eventId,
        title: event.title,
        sources,
        currentGenres: event.genres,
        availableGenreEvidence: available,
        evidenceStrength: 'strong',
        recommendedGenres: recommended,
        classification: 'GENRE_RECOVERABLE',
        reason: 'verified_description_or_source_genre_evidence',
      };
    }

    if (event.genres.length > 0 && recommended.length === 0) {
      return {
        eventId: event.eventId,
        title: event.title,
        sources,
        currentGenres: event.genres,
        availableGenreEvidence: available,
        evidenceStrength: 'weak',
        recommendedGenres: event.genres,
        classification: 'GENRE_VERIFIED',
      };
    }

    return {
      eventId: event.eventId,
      title: event.title,
      sources,
      currentGenres: event.genres,
      availableGenreEvidence: available,
      evidenceStrength: 'none',
      recommendedGenres: [],
      classification: 'GENRE_UNRESOLVED_NO_EVIDENCE',
    };
  });
}

export function repairRecoverableGenres(
  runQuery: LinkedQueryExecutor,
  entries: GenreCoverageEntry[],
): number {
  let repaired = 0;
  for (const entry of entries.filter((item) => item.classification === 'GENRE_RECOVERABLE')) {
    runQuery(`DELETE FROM public.event_genres WHERE event_id = '${entry.eventId}'::uuid;`);
    const normalized = normalizeOfficialGenreLabels(entry.recommendedGenres);
    for (const [index, label] of normalizedGenresToExplicitLabels(normalized.normalized).entries()) {
      const genreKey =
        normalized.normalized.find((genre) => genre.displayName === label)?.genreKey ??
        label.toLowerCase().replace(/\s+/g, '-');
      runQuery(
        `INSERT INTO public.event_genres (event_id, genre_key, display_name, sort_order)
         VALUES ('${entry.eventId}'::uuid, '${genreKey.replace(/'/g, "''")}', '${label.replace(/'/g, "''")}', ${index});`,
      );
    }
    repaired += 1;
  }
  return repaired;
}
