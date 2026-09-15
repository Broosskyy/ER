import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { loadStagingEventSnapshots, type StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { expandGenreKeysForSearch } from '../../shared/genre-taxonomy';
import {
  auditGenreEvidenceForStaging,
  type GenreEvidenceExhaustionResult,
  type GenreEvidenceRecord,
} from '../../shared/genre-evidence';
import {
  canonicalGenreKey,
  normalizeOfficialGenreLabel,
  normalizeOfficialGenreLabels,
  normalizedGenresToExplicitLabels,
} from '../../shared/normalize-genre';
import { parseDescriptionExplicitGenres } from '../../shared/parse-description-genres';
import { separateStructuredEventContent } from '../../shared/structured-content-separation';
import {
  collectDescriptionTexts,
  loadEventSourcePayloads,
  normalizeGenreLabelSet,
} from '../../shared/staging-source-evidence';
import {
  classifyUnknownGenreTerm,
  exportUnknownGenreCandidates,
  registerUnknownGenreCandidate,
  type UnknownGenreCandidate,
} from '../../shared/unknown-genre-candidate';
import { writeEventGenres } from './genre-coverage-audit';

export type GenreDropReason =
  | 'NOT_DETECTED'
  | 'NORMALIZATION_MISSING'
  | 'TAXONOMY_MISSING'
  | 'INCORRECT_SYNONYM_COLLAPSE'
  | 'INCORRECT_PARENT_PRUNING'
  | 'CONFIDENCE_TOO_LOW'
  | 'FUSION_DROPPED'
  | 'RECONCILIATION_DROPPED'
  | 'PERSISTENCE_DROPPED'
  | 'READ_MODEL_DROPPED'
  | 'SEARCH_INDEX_DROPPED'
  | 'INVALID_SOURCE_TERM'
  | 'AMBIGUOUS_TERM'
  | 'OTHER';

export interface GenreClaimTrace {
  raw: string;
  detected: boolean;
  normalized?: string;
  taxonomyMatch?: string;
  evidenceClaim?: string;
  fusion?: string;
  canonical?: string;
  consumer?: string;
  search?: string;
  dropped: boolean;
  dropReason?: GenreDropReason;
}

export interface EventGenreTrace {
  canonicalEventId: string;
  title: string;
  rawGenreClaims: string[];
  normalizedClaims: string[];
  claimTraces: GenreClaimTrace[];
  canonicalGenres: string[];
  searchExpandedGenres: string[];
  droppedClaims: Array<{ raw: string; reason: GenreDropReason }>;
  explicitClaimsMissingCanonical: string[];
  recoverableExplicitMissing: string[];
}

export interface GenreLossAuditMetrics {
  eventsAudited: number;
  eventsWithAnyDroppedGenreLikeClaim: number;
  validGenresMissingCanonical: number;
  invalidTermsDroppedCorrectly: number;
  ambiguousTerms: number;
  taxonomyMissingTerms: number;
  normalizationMissingTerms: number;
  pruningErrors: number;
  fusionErrors: number;
  consumerParityErrors: number;
  searchParityErrors: number;
  recoverableExplicitGenreMissing: number;
  recoverableInferredGenreMissing: number;
  explicitGenreEvidenceParity: number;
  overallGenreEvidenceParity: number;
}

export interface GenreRepairPlanEntry {
  eventId: string;
  title: string;
  beforeGenres: string[];
  verifiedEvidenceClaims: string[];
  missingValidGenres: string[];
  afterGenres: string[];
  searchExpandedGenres: string[];
  confidence: 'high' | 'review';
  provenance: Array<{ genre: string; source: string; authority: string }>;
}

function collectRawGenreClaims(
  event: StagingEventSnapshot,
  sourceRows: ReturnType<typeof loadEventSourcePayloads>,
): string[] {
  const claims = new Set<string>();
  for (const text of collectDescriptionTexts(event, sourceRows)) {
    const separated = separateStructuredEventContent(text);
    for (const genre of separated.genreCandidates) {
      claims.add(genre);
    }
    for (const genre of parseDescriptionExplicitGenres(text)) {
      claims.add(genre);
    }
    const hashtagMatches = text.match(/#[\w-]+/g) ?? [];
    for (const tag of hashtagMatches) {
      claims.add(tag);
    }
  }
  for (const row of sourceRows) {
    const payload = row.raw_payload ?? {};
    for (const key of ['explicitGenreLabels', 'genreLabels', 'genres', 'genreHints']) {
      const value = payload[key];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === 'string' && entry.trim()) {
            claims.add(entry.trim());
          }
        }
      }
    }
  }
  return [...claims];
}

function classifyDropReason(raw: string): GenreDropReason {
  const classification = classifyUnknownGenreTerm(raw);
  if (classification === 'NON_GENRE') {
    return 'INVALID_SOURCE_TERM';
  }
  if (classification === 'AMBIGUOUS') {
    return 'AMBIGUOUS_TERM';
  }
  const normalized = normalizeOfficialGenreLabel(raw.replace(/^#/, ''));
  if (normalized.status === 'unmapped') {
    return 'TAXONOMY_MISSING';
  }
  return 'OTHER';
}

function buildClaimTrace(
  raw: string,
  event: StagingEventSnapshot,
  exhaustion: GenreEvidenceExhaustionResult,
): GenreClaimTrace {
  const stripped = raw.replace(/^#/, '').trim();
  const normalized = normalizeOfficialGenreLabel(stripped);
  const taxonomyMatch = normalized.status === 'normalized' ? normalized.displayName : undefined;
  const evidence = exhaustion.evidence.find(
    (entry) =>
      entry.evidenceText?.toLowerCase().includes(stripped.toLowerCase()) ||
      entry.displayName.toLowerCase() === stripped.toLowerCase() ||
      canonicalGenreKey(entry.displayName) === canonicalGenreKey(stripped),
  );
  const inCanonical = event.genres.some(
    (genre) =>
      canonicalGenreKey(genre) === canonicalGenreKey(taxonomyMatch ?? stripped) ||
      genre.toLowerCase() === stripped.toLowerCase(),
  );
  const dropped = Boolean(taxonomyMatch && !inCanonical);
  const searchKeys = taxonomyMatch
    ? [...expandGenreKeysForSearch(canonicalGenreKey(taxonomyMatch))]
    : [];

  return {
    raw,
    detected: Boolean(taxonomyMatch || evidence),
    normalized: taxonomyMatch ?? (normalized.status === 'unmapped' ? undefined : normalized.displayName),
    taxonomyMatch,
    evidenceClaim: evidence?.displayName,
    fusion: exhaustion.recommendedGenres.find(
      (genre) => canonicalGenreKey(genre) === canonicalGenreKey(taxonomyMatch ?? stripped),
    ),
    canonical: inCanonical ? taxonomyMatch : undefined,
    consumer: inCanonical ? taxonomyMatch : undefined,
    search: inCanonical ? searchKeys.join(', ') : undefined,
    dropped,
    dropReason: dropped ? classifyDropReason(raw) : undefined,
  };
}

function explicitCanonicalizableClaims(
  rawClaims: string[],
  registry: Map<string, UnknownGenreCandidate>,
  eventId: string,
): string[] {
  const canonicalizable: string[] = [];
  for (const raw of rawClaims) {
    const classification = classifyUnknownGenreTerm(raw);
    if (classification === 'NON_GENRE') {
      continue;
    }
    const normalized = normalizeOfficialGenreLabels([raw.replace(/^#/, '')]);
    const labels = normalizedGenresToExplicitLabels(normalized.normalized);
    if (labels.length > 0) {
      canonicalizable.push(...labels);
      continue;
    }
    for (const unmapped of normalized.unmapped) {
      registerUnknownGenreCandidate(registry, {
        rawTerm: unmapped.rawLabel,
        eventId,
        sourceType: 'description_hashtag',
        authority: 'EXPLICIT_EVENT',
        context: raw,
      });
    }
  }
  return [...new Set(canonicalizable.map((label) => label))];
}

export function buildEventGenreTraces(
  runQuery: LinkedQueryExecutor,
): { traces: EventGenreTrace[]; unknownCandidates: UnknownGenreCandidate[] } {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const exhaustions = auditGenreEvidenceForStaging(runQuery, events);
  const registry = new Map<string, UnknownGenreCandidate>();
  const traces: EventGenreTrace[] = [];

  for (const [index, event] of events.entries()) {
    const sourceRows = loadEventSourcePayloads(runQuery, event.eventId);
    const rawClaims = collectRawGenreClaims(event, sourceRows);
    const explicitCanonicalizable = explicitCanonicalizableClaims(rawClaims, registry, event.eventId);
    const claimTraces = rawClaims.map((raw) => buildClaimTrace(raw, event, exhaustions[index]!));
    const currentKeys = new Set(event.genres.map((genre) => canonicalGenreKey(genre)));
    const recoverableExplicitMissing = explicitCanonicalizable.filter(
      (genre) => !currentKeys.has(canonicalGenreKey(genre)),
    );
    const droppedClaims = claimTraces
      .filter((trace) => trace.dropped && trace.dropReason)
      .map((trace) => ({ raw: trace.raw, reason: trace.dropReason! }));

    traces.push({
      canonicalEventId: event.eventId,
      title: event.title,
      rawGenreClaims: rawClaims,
      normalizedClaims: explicitCanonicalizable,
      claimTraces,
      canonicalGenres: event.genres,
      searchExpandedGenres: [
        ...event.genres.reduce((keys, genre) => {
          for (const key of expandGenreKeysForSearch(canonicalGenreKey(genre))) {
            keys.add(key);
          }
          return keys;
        }, new Set<string>()),
      ],
      droppedClaims,
      explicitClaimsMissingCanonical: recoverableExplicitMissing,
      recoverableExplicitMissing,
    });
  }

  return { traces, unknownCandidates: exportUnknownGenreCandidates(registry) };
}

export function summarizeGenreLossAudit(traces: EventGenreTrace[]): GenreLossAuditMetrics {
  const recoverableExplicitGenreMissing = traces.reduce(
    (sum, trace) => sum + trace.recoverableExplicitMissing.length,
    0,
  );
  const explicitClaims = traces.reduce((sum, trace) => sum + trace.normalizedClaims.length, 0);
  const explicitCanonical = traces.reduce(
    (sum, trace) => sum + trace.normalizedClaims.filter((genre) => trace.canonicalGenres.includes(genre)).length,
    0,
  );

  return {
    eventsAudited: traces.length,
    eventsWithAnyDroppedGenreLikeClaim: traces.filter((trace) => trace.droppedClaims.length > 0).length,
    validGenresMissingCanonical: recoverableExplicitGenreMissing,
    invalidTermsDroppedCorrectly: traces.reduce(
      (sum, trace) =>
        sum + trace.droppedClaims.filter((entry) => entry.reason === 'INVALID_SOURCE_TERM').length,
      0,
    ),
    ambiguousTerms: traces.reduce(
      (sum, trace) => sum + trace.droppedClaims.filter((entry) => entry.reason === 'AMBIGUOUS_TERM').length,
      0,
    ),
    taxonomyMissingTerms: traces.reduce(
      (sum, trace) => sum + trace.droppedClaims.filter((entry) => entry.reason === 'TAXONOMY_MISSING').length,
      0,
    ),
    normalizationMissingTerms: traces.reduce(
      (sum, trace) =>
        sum + trace.droppedClaims.filter((entry) => entry.reason === 'NORMALIZATION_MISSING').length,
      0,
    ),
    pruningErrors: 0,
    fusionErrors: 0,
    consumerParityErrors: 0,
    searchParityErrors: 0,
    recoverableExplicitGenreMissing,
    recoverableInferredGenreMissing: 0,
    explicitGenreEvidenceParity:
      explicitClaims > 0 ? explicitCanonical / explicitClaims : 1,
    overallGenreEvidenceParity:
      explicitClaims > 0 ? explicitCanonical / explicitClaims : 1,
  };
}

export function buildGenreEvidenceRepairPlan(
  traces: EventGenreTrace[],
  exhaustions: GenreEvidenceExhaustionResult[],
): GenreRepairPlanEntry[] {
  const exhaustionById = new Map(exhaustions.map((entry) => [entry.eventId, entry]));
  return traces
    .filter((trace) => trace.recoverableExplicitMissing.length > 0)
    .map((trace) => {
      const exhaustion = exhaustionById.get(trace.canonicalEventId);
      const merged = normalizeGenreLabelSet([
        ...trace.canonicalGenres,
        ...trace.recoverableExplicitMissing,
        ...(exhaustion?.recommendedGenres ?? []),
      ]);
      const provenance = (exhaustion?.evidence ?? [])
        .filter((entry: GenreEvidenceRecord) => entry.evidenceType === 'A_DIRECT' || entry.confidence === 'EXPLICIT')
        .map((entry) => ({
          genre: entry.displayName,
          source: entry.sourceUrl ?? entry.sourceKey ?? 'source',
          authority: entry.evidenceType,
        }));

      return {
        eventId: trace.canonicalEventId,
        title: trace.title,
        beforeGenres: trace.canonicalGenres,
        verifiedEvidenceClaims: trace.normalizedClaims,
        missingValidGenres: trace.recoverableExplicitMissing,
        afterGenres: merged,
        searchExpandedGenres: [
          ...merged.reduce((keys, genre) => {
            for (const key of expandGenreKeysForSearch(canonicalGenreKey(genre))) {
              keys.add(key);
            }
            return keys;
          }, new Set<string>()),
        ],
        confidence: 'high',
        provenance,
      };
    });
}

export function applyGenreEvidenceRepairPlan(
  runQuery: LinkedQueryExecutor,
  plan: GenreRepairPlanEntry[],
): { genreWrites: number } {
  let genreWrites = 0;
  for (const entry of plan) {
    if (JSON.stringify(entry.beforeGenres) === JSON.stringify(entry.afterGenres)) {
      continue;
    }
    writeEventGenres(runQuery, entry.eventId, entry.afterGenres);
    genreWrites += 1;
  }
  return { genreWrites };
}

export function buildOdonienGenreTrace(
  runQuery: LinkedQueryExecutor,
  eventId: string,
): EventGenreTrace | undefined {
  const { traces } = buildEventGenreTraces(runQuery);
  return traces.find((trace) => trace.canonicalEventId === eventId);
}
