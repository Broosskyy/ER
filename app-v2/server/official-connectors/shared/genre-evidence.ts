import { deriveLineupGenresFromIdentityCache } from './artist-genre-corroboration-pass';
import { canonicalGenreKey } from './normalize-genre';
import {
  collectGenreEvidenceLabels,
  collectLineupEvidence,
  loadEventSourcePayloads,
  normalizeGenreLabelSet,
  type SourcePayloadRow,
} from './staging-source-evidence';
import type { StagingEventSnapshot } from '../../ingestion/sync/canonical-consolidation';
import type { LinkedQueryExecutor } from '../../ingestion/sync/linked-db';

export type GenreEvidenceTier = 'A_DIRECT' | 'B_STRONG' | 'C_LINEUP' | 'D_CONTEXTUAL';
export type GenreConfidenceBand = 'EXPLICIT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED';

export interface GenreEvidenceRecord {
  genreKey: string;
  displayName: string;
  confidence: GenreConfidenceBand;
  evidenceType: GenreEvidenceTier;
  sourceKey?: string;
  sourceUrl?: string;
  evidenceText?: string;
  classificationReason: string;
}

export interface GenreEvidenceExhaustionResult {
  eventId: string;
  title: string;
  currentGenres: string[];
  recommendedGenres: string[];
  evidence: GenreEvidenceRecord[];
  checkedLayers: string[];
  lineupDerivedGenres: string[];
  explicitGenreCount: number;
  highConfidenceCount: number;
  lineupDerivedCount: number;
}

function confidenceFromTier(tier: GenreEvidenceTier): GenreConfidenceBand {
  switch (tier) {
    case 'A_DIRECT':
      return 'EXPLICIT';
    case 'B_STRONG':
      return 'HIGH';
    case 'C_LINEUP':
      return 'HIGH';
    case 'D_CONTEXTUAL':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function genreKeysEquivalent(left: string[], right: string[]): boolean {
  const a = new Set(left.map((key) => canonicalGenreKey(key)));
  const b = new Set(right.map((key) => canonicalGenreKey(key)));
  if (a.size !== b.size) {
    return false;
  }
  for (const key of a) {
    if (!b.has(key)) {
      return false;
    }
  }
  return true;
}

export function exhaustGenreEvidence(
  event: StagingEventSnapshot,
  sourceRows: SourcePayloadRow[],
): GenreEvidenceExhaustionResult {
  const checkedLayers: string[] = [];
  const evidence: GenreEvidenceRecord[] = [];

  const { labels: collectedLabels, checkedLayers: genreLayers } = collectGenreEvidenceLabels(
    event,
    sourceRows,
  );
  checkedLayers.push(...genreLayers);

  for (const row of sourceRows) {
    const payload = row.raw_payload ?? {};
    const structured = [
      ...(Array.isArray(payload.explicitGenreLabels) ? payload.explicitGenreLabels : []),
    ].filter((entry): entry is string => typeof entry === 'string');
    for (const label of structured) {
      const normalized = normalizeGenreLabelSet([label]);
      for (const displayName of normalized) {
        evidence.push({
          genreKey: canonicalGenreKey(displayName),
          displayName,
          confidence: 'EXPLICIT',
          evidenceType: 'A_DIRECT',
          sourceKey: String(payload.sourceEventKey ?? row.source_role),
          sourceUrl: row.source_url,
          evidenceText: label,
          classificationReason: 'structured_source_genre',
        });
      }
    }
  }

  for (const label of collectedLabels.filter((entry) => !event.genres.includes(entry))) {
    const normalized = normalizeGenreLabelSet([label]);
    for (const displayName of normalized) {
      if (evidence.some((entry) => entry.displayName === displayName)) {
        continue;
      }
      evidence.push({
        genreKey: canonicalGenreKey(displayName),
        displayName,
        confidence: 'HIGH',
        evidenceType: 'B_STRONG',
        evidenceText: label,
        classificationReason: 'description_or_inferred_source_genre',
      });
    }
  }

  const { lineup, checkedLayers: lineupLayers } = collectLineupEvidence(event, sourceRows);
  checkedLayers.push(...lineupLayers);

  const sourceEventKey =
    event.sources.find((source) => source.sourceEventKey)?.sourceEventKey ?? event.eventId;
  const lineupProjection = deriveLineupGenresFromIdentityCache({
    sourceEventKey,
    lineup,
    officialGenres: event.genres,
  });
  if (lineupProjection.checkedArtistCache) {
    checkedLayers.push('artist_identity_cache');
  }
  const lineupDerivedGenres = lineupProjection.genres.map((genre) => genre.displayName);
  for (const genre of lineupProjection.genres) {
    if (!evidence.some((entry) => entry.genreKey === genre.genreKey)) {
      evidence.push({
        genreKey: genre.genreKey,
        displayName: genre.displayName,
        confidence: confidenceFromTier('C_LINEUP'),
        evidenceType: 'C_LINEUP',
        classificationReason: 'lineup_artist_metadata_consensus',
      });
    }
  }

  const recommended = normalizeGenreLabelSet([
    ...event.genres,
    ...evidence.map((entry) => entry.displayName),
  ]);

  return {
    eventId: event.eventId,
    title: event.title,
    currentGenres: event.genres,
    recommendedGenres: recommended,
    evidence,
    checkedLayers: [...new Set(checkedLayers)],
    lineupDerivedGenres,
    explicitGenreCount: evidence.filter((entry) => entry.evidenceType === 'A_DIRECT').length,
    highConfidenceCount: evidence.filter(
      (entry) => entry.confidence === 'EXPLICIT' || entry.confidence === 'HIGH',
    ).length,
    lineupDerivedCount: lineupDerivedGenres.length,
  };
}

export function hasGenreConflict(
  currentGenres: string[],
  recommendedGenres: string[],
): boolean {
  if (currentGenres.length === 0 || recommendedGenres.length === 0) {
    return false;
  }
  return !genreKeysEquivalent(
    currentGenres.map((label) => canonicalGenreKey(label)),
    recommendedGenres.map((label) => canonicalGenreKey(label)),
  );
}

export function auditGenreEvidenceForStaging(
  runQuery: LinkedQueryExecutor,
  events: StagingEventSnapshot[],
): GenreEvidenceExhaustionResult[] {
  return events.map((event) => {
    const sourceRows = loadEventSourcePayloads(runQuery, event.eventId);
    return exhaustGenreEvidence(event, sourceRows);
  });
}
