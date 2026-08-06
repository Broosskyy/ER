/**
 * Phase 4.6.4 — Exact lineup first-failure stages and root-cause resolution.
 * Eliminates vague `parser_or_merge_unknown` by inspecting import provenance.
 */

import { isLineupPlaceholderArtist, isCollapsedLineupArtistName } from '@/features/events/domain/lineup-artist-quality';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';

export type LineupFirstFailureStage =
  | 1 // Source truly contains no lineup
  | 2 // detail URL missing
  | 3 // detail fetch disabled / not fetched
  | 4 // detail fetch blocked
  | 5 // parser does not support HTML structure
  | 6 // lineup exists only in description/free text
  | 7 // lineup exists only on poster/flyer image
  | 8 // parser extracted invalid values
  | 9 // normalized payload lost valid values
  | 10 // multi-Origin merge lost better lineup
  | 11 // Artist resolution failed
  | 12 // event_artists write skipped
  | 13 // stale invalid relation blocked repair
  | 14 // projection omitted canonical lineup
  | 15 // UI omitted projected lineup
  | 16; // Event stale, archived or ineligible

export type LineupClassification =
  | 'complete'
  | 'partial'
  | 'title_inferred_only'
  | 'missing'
  | 'invalid'
  | 'unavailable'
  | 'flyer_extracted_review_required';

export type LineupArtistProvenance = 'structured' | 'title_inference' | 'mixed' | 'flyer';

export interface LineupImportTrace {
  importRecordId?: string;
  sourceId: string;
  externalId?: string;
  artistNames?: string[];
  lineupEntryCount?: number;
  prioritizedNames: string[];
  prioritizedSource?: LineupArtistProvenance | string;
  detailPagesFetched?: number;
  detailBlockedByPow?: boolean;
  detailUrl?: string;
  imageUrl?: string;
  posterMetadata?: {
    status?: string;
    artistNames?: string[];
    rawText?: string;
  };
}

export interface LineupRootCauseInput {
  eventId: string;
  title: string;
  description?: string;
  publicationStatus?: string;
  validCanonicalCount: number;
  invalidCanonicalNames: string[];
  canonicalArtistNames: string[];
  importTraces: LineupImportTrace[];
  imageUrl?: string;
  flyerUrl?: string;
}

export interface LineupRootCauseResult {
  classification: LineupClassification;
  firstFailureStage: LineupFirstFailureStage | null;
  failureEvidence: string;
  rootCauseClass: string;
  genericFixClass: string;
  completenessState:
    | 'complete'
    | 'partial'
    | 'title_inferred_only'
    | 'flyer_extracted_review_required'
    | 'blocked_detail_fetch'
    | 'unavailable';
  requiresReimport: boolean;
  requiresManualReview: boolean;
  bestImportNameCount: number;
  bestImportSource?: string;
  artistProvenance: LineupArtistProvenance;
}

const TITLE_GUEST_HINT = /\b(w\/|ft\.?|feat\.?|featuring|pres\.?|presents)\b/i;

function bestImportTrace(traces: LineupImportTrace[]): LineupImportTrace | undefined {
  return [...traces].sort((a, b) => b.prioritizedNames.length - a.prioritizedNames.length)[0];
}

function dominantProvenance(traces: LineupImportTrace[]): LineupArtistProvenance {
  const best = bestImportTrace(traces);
  const source = best?.prioritizedSource;
  if (source === 'title_inference') return 'title_inference';
  if (source === 'structured') return 'structured';
  if (source === 'flyer') return 'flyer';
  if (traces.some((t) => t.prioritizedSource === 'structured')) return 'mixed';
  return 'mixed';
}

function hasStructuredLineup(trace: LineupImportTrace): boolean {
  return (
    (trace.lineupEntryCount ?? 0) > 0 ||
    trace.prioritizedSource === 'structured' ||
    Boolean(
      trace.artistNames?.length &&
        trace.prioritizedSource !== 'title_inference' &&
        trace.prioritizedNames.length > 0,
    )
  );
}

function looksLikeInvalidExtraction(name: string, title: string): boolean {
  if (isLineupPlaceholderArtist(name)) return true;
  if (isCollapsedLineupArtistName(name)) return true;
  const lower = name.toLowerCase().trim();
  if (/^by\s+/i.test(lower)) return true;
  if (/\bedition\b/i.test(lower) && !/\bmdma\b/i.test(title)) return true;
  if (lower === 'organization' || lower === 'line-up' || lower === 'lineup') return true;
  return false;
}

function descriptionHasUnparsedLineup(description: string | undefined, importCount: number): boolean {
  if (!description?.trim()) return false;
  const extracted = extractLineupNamesFromDescriptionText(description);
  return Boolean(extracted && extracted.length > importCount);
}

function flyerMayContainLineup(input: LineupRootCauseInput): boolean {
  const images = [input.imageUrl, input.flyerUrl, ...input.importTraces.map((t) => t.imageUrl)].filter(
    Boolean,
  );
  if (images.length === 0) return false;
  return input.importTraces.every((t) => t.prioritizedNames.length === 0);
}

export function resolveLineupRootCause(input: LineupRootCauseInput): LineupRootCauseResult {
  const best = bestImportTrace(input.importTraces);
  const importCount = best?.prioritizedNames.length ?? 0;
  const provenance = dominantProvenance(input.importTraces);
  const anyDetailUrl = input.importTraces.some((t) => Boolean(t.detailUrl));
  const anyDetailFetched = input.importTraces.some((t) => (t.detailPagesFetched ?? 0) > 0);
  const anyPowBlocked = input.importTraces.some((t) => t.detailBlockedByPow);
  const ticketIoNoFetch = input.importTraces.some(
    (t) =>
      (t.sourceId.includes('ticket-io') || t.sourceId.includes('ticket-kings')) &&
      (t.detailPagesFetched ?? 0) === 0 &&
      Boolean(t.detailUrl),
  );
  const invalidFromCanonical = input.invalidCanonicalNames.length > 0;
  const invalidFromImport =
    (best?.prioritizedNames ?? []).filter((n) => looksLikeInvalidExtraction(n, input.title)).length > 0;

  const base = {
    bestImportNameCount: importCount,
    bestImportSource: best?.sourceId,
    artistProvenance: provenance,
  };

  if (input.publicationStatus && input.publicationStatus !== 'published') {
    return {
      ...base,
      classification: 'unavailable',
      firstFailureStage: 16,
      failureEvidence: `event status=${input.publicationStatus}`,
      rootCauseClass: 'event_ineligible',
      genericFixClass: 'none',
      completenessState: 'unavailable',
      requiresReimport: false,
      requiresManualReview: false,
    };
  }

  if (invalidFromCanonical || invalidFromImport) {
    return {
      ...base,
      classification: 'invalid',
      firstFailureStage: 8,
      failureEvidence: `invalid artist labels: ${[...input.invalidCanonicalNames, ...(best?.prioritizedNames ?? []).filter((n) => looksLikeInvalidExtraction(n, input.title))].join(', ')}`,
      rootCauseClass: 'parser_invalid_extraction',
      genericFixClass: 'reject_invalid_tokens_and_reimport',
      completenessState: 'partial',
      requiresReimport: true,
      requiresManualReview: true,
    };
  }

  if (importCount > 0 && input.validCanonicalCount === 0) {
    return {
      ...base,
      classification: 'missing',
      firstFailureStage: 12,
      failureEvidence: `import has ${importCount} names; canonical empty`,
      rootCauseClass: 'event_artists_write_skipped',
      genericFixClass: 'run_lineup_projection_repair',
      completenessState: 'partial',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (importCount > 0 && input.validCanonicalCount > 0 && input.validCanonicalCount < importCount) {
    return {
      ...base,
      classification: 'partial',
      firstFailureStage: 9,
      failureEvidence: `canonical ${input.validCanonicalCount} < import ${importCount}`,
      rootCauseClass: 'normalized_payload_or_publish_partial',
      genericFixClass: 'repair_projection_and_reimport',
      completenessState: 'partial',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (anyPowBlocked && importCount === 0) {
    return {
      ...base,
      classification: 'missing',
      firstFailureStage: 4,
      failureEvidence: 'detailEnrichment.blockedByPow=true',
      rootCauseClass: 'detail_fetch_blocked',
      genericFixClass: 'enable_detail_fetch_after_pow',
      completenessState: 'blocked_detail_fetch',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (descriptionHasUnparsedLineup(input.description, importCount)) {
    return {
      ...base,
      classification: importCount > 0 ? 'partial' : 'missing',
      firstFailureStage: 6,
      failureEvidence: 'description contains lineup markers not reflected in import',
      rootCauseClass: 'description_lineup_unparsed',
      genericFixClass: 'parse_description_lineup_block',
      completenessState: importCount > 0 ? 'partial' : 'title_inferred_only',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (flyerMayContainLineup(input) && anyDetailUrl && !anyDetailFetched) {
    return {
      ...base,
      classification: 'missing',
      firstFailureStage: 7,
      failureEvidence: 'official artwork present; textual lineup absent until detail/flyer enrichment',
      rootCauseClass: 'lineup_on_flyer_only',
      genericFixClass: 'flyer_extraction_review',
      completenessState: 'flyer_extracted_review_required',
      requiresReimport: true,
      requiresManualReview: true,
    };
  }

  if (ticketIoNoFetch && provenance === 'title_inference') {
    return {
      ...base,
      classification: 'title_inferred_only',
      firstFailureStage: 3,
      failureEvidence: 'detail URL present but pagesFetched=0; only title-inferred artist available',
      rootCauseClass: 'detail_not_fetched',
      genericFixClass: 'enable_detail_fetch_and_reimport',
      completenessState: 'title_inferred_only',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (anyDetailUrl && !anyDetailFetched && importCount === 0) {
    return {
      ...base,
      classification: 'missing',
      firstFailureStage: 3,
      failureEvidence: 'detail URL known but no detail pages fetched and no lineup in import',
      rootCauseClass: 'detail_not_fetched',
      genericFixClass: 'enable_detail_fetch_and_reimport',
      completenessState: 'blocked_detail_fetch',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (!anyDetailUrl && importCount === 0) {
    return {
      ...base,
      classification: 'unavailable',
      firstFailureStage: 2,
      failureEvidence: 'no detail URL on origins and no import lineup',
      rootCauseClass: 'detail_url_missing',
      genericFixClass: 'configure_detail_url',
      completenessState: 'unavailable',
      requiresReimport: false,
      requiresManualReview: true,
    };
  }

  if (anyDetailUrl && !anyDetailFetched && importCount > 0 && provenance !== 'structured') {
    return {
      ...base,
      classification: 'title_inferred_only',
      firstFailureStage: 3,
      failureEvidence: 'structured detail not fetched; lineup from title inference only',
      rootCauseClass: 'detail_not_fetched',
      genericFixClass: 'enable_detail_fetch_and_reimport',
      completenessState: 'title_inferred_only',
      requiresReimport: true,
      requiresManualReview: TITLE_GUEST_HINT.test(input.title),
    };
  }

  if (anyDetailUrl && importCount === 0) {
    return {
      ...base,
      classification: 'missing',
      firstFailureStage: 5,
      failureEvidence: 'detail URL exists but parser produced no lineup',
      rootCauseClass: 'parser_format_unsupported',
      genericFixClass: 'extend_detail_parser',
      completenessState: 'unavailable',
      requiresReimport: true,
      requiresManualReview: false,
    };
  }

  if (
    input.validCanonicalCount >= importCount &&
    importCount > 0 &&
    (provenance === 'structured' || input.importTraces.some(hasStructuredLineup))
  ) {
    return {
      ...base,
      classification: 'complete',
      firstFailureStage: null,
      failureEvidence: `exact cardinality match (${importCount}) from structured source`,
      rootCauseClass: 'none',
      genericFixClass: 'none',
      completenessState: 'complete',
      requiresReimport: false,
      requiresManualReview: false,
    };
  }

  if (
    input.validCanonicalCount === importCount &&
    importCount > 0 &&
    provenance === 'title_inference'
  ) {
    const titleArtists = extractArtistsFromEventTitle(input.title) ?? [];
    return {
      ...base,
      classification: 'title_inferred_only',
      firstFailureStage: titleArtists.length > importCount ? 6 : null,
      failureEvidence:
        importCount === 1
          ? 'single artist from title inference; structured lineup not yet fetched'
          : 'lineup matches title inference only',
      rootCauseClass: 'title_inferred_only',
      genericFixClass: ticketIoNoFetch ? 'enable_detail_fetch_and_reimport' : 'none',
      completenessState: 'title_inferred_only',
      requiresReimport: ticketIoNoFetch,
      requiresManualReview: TITLE_GUEST_HINT.test(input.title),
    };
  }

  if (input.validCanonicalCount === importCount && importCount === 1) {
    return {
      ...base,
      classification: 'complete',
      firstFailureStage: null,
      failureEvidence: 'legitimate single-artist billing with exact canonical match',
      rootCauseClass: 'single_artist_complete',
      genericFixClass: 'none',
      completenessState: 'complete',
      requiresReimport: false,
      requiresManualReview: false,
    };
  }

  if (importCount === 0) {
    return {
      ...base,
      classification: 'unavailable',
      firstFailureStage: 1,
      failureEvidence: 'no lineup in accessible source payloads',
      rootCauseClass: 'source_no_lineup',
      genericFixClass: 'none',
      completenessState: 'unavailable',
      requiresReimport: false,
      requiresManualReview: false,
    };
  }

  return {
    ...base,
    classification: 'partial',
    firstFailureStage: 5,
    failureEvidence: `unresolved partial lineup (${input.validCanonicalCount}/${importCount})`,
    rootCauseClass: 'parser_format_unsupported',
    genericFixClass: 'extend_detail_parser',
    completenessState: 'partial',
    requiresReimport: true,
    requiresManualReview: true,
  };
}

export const LINEUP_FAILURE_STAGE_LABELS: Record<LineupFirstFailureStage, string> = {
  1: 'source_no_lineup',
  2: 'detail_url_missing',
  3: 'detail_fetch_disabled',
  4: 'detail_fetch_blocked',
  5: 'parser_unsupported',
  6: 'description_lineup_only',
  7: 'flyer_lineup_only',
  8: 'parser_invalid_extraction',
  9: 'normalized_payload_loss',
  10: 'merge_lost_lineup',
  11: 'artist_resolution_failed',
  12: 'event_artists_write_skipped',
  13: 'stale_relation_blocked',
  14: 'projection_omitted',
  15: 'ui_omitted',
  16: 'event_ineligible',
};
