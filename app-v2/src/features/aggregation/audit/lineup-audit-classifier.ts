import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

import { detectInvalidArtistSignals, isSuspiciousArtistName } from './lineup-audit-signals';
import type {
  EventLineupTraceRow,
  LineupRootCauseClass,
  ModelConsistencyClass,
} from './lineup-audit-types';

export function classifyModelConsistency(input: {
  structuredEntryCount: number;
  structuredArtistNames: string[];
  legacyArtistNames: string[];
  apiLineupEntryCount: number;
  apiArtistNames: string[];
}): ModelConsistencyClass {
  const structuredFlat = input.structuredArtistNames;
  const legacy = input.legacyArtistNames;
  const api = input.apiArtistNames;

  const structuredKey = structuredFlat.map(normalizeMatchText).join('|');
  const legacyKey = legacy.map(normalizeMatchText).join('|');
  const apiKey = api.map(normalizeMatchText).join('|');

  if (input.structuredEntryCount === 0 && legacy.length === 0 && api.length === 0) {
    return 'fully_aligned';
  }

  if (
    input.structuredEntryCount > 0 &&
    structuredKey === legacyKey &&
    structuredKey === apiKey &&
    input.apiLineupEntryCount === input.structuredEntryCount
  ) {
    return 'fully_aligned';
  }

  if (input.structuredEntryCount === 0 && legacy.length > 0) {
    return 'structured_absent_legacy_present';
  }

  if (input.structuredEntryCount > 0 && input.apiLineupEntryCount === 0 && legacy.length > 0) {
    return 'structured_present_api_omitted';
  }

  if (
    input.structuredEntryCount > 0 &&
    structuredKey === apiKey &&
    structuredKey !== legacyKey
  ) {
    return 'structured_correct_legacy_wrong';
  }

  if (
    input.structuredEntryCount > 0 &&
    legacyKey === apiKey &&
    structuredKey !== legacyKey
  ) {
    return 'structured_wrong_legacy_correct';
  }

  if (structuredKey !== legacyKey && structuredKey !== apiKey && legacyKey !== apiKey) {
    return 'both_wrong';
  }

  return 'api_correct_ui_unknown';
}

export function classifyEventRootCause(input: {
  eventId: string;
  title: string;
  modelConsistency: ModelConsistencyClass;
  invalidArtistNames: string[];
  collapsedArtistNames: string[];
  titleInferenceArtists: string[];
  flyerEvidencePresent: boolean;
  detailBlocked: boolean;
  structuredEntryCount: number;
  legacyArtistNames: string[];
  rawArtistNames: string[];
  contaminationSuspect?: EventLineupTraceRow['contaminationSuspect'];
}): { rootCauseClass: LineupRootCauseClass | null; firstFailureStage: string; genericFixClass: string; pipelineHealthy?: boolean } {
  if (input.contaminationSuspect) {
    return {
      rootCauseClass: 'B_CROSS_EVENT_STATE_LEAKAGE',
      firstFailureStage: '9_multi_origin_event_matching',
      genericFixClass: 'P0_event_ownership_isolation',
    };
  }

  if (input.invalidArtistNames.length > 0) {
    const prose = input.invalidArtistNames.filter((name) => {
      const signals = detectInvalidArtistSignals(name);
      return signals.some((signal) =>
        ['prose_sentence', 'html_entity', 'amenity', 'url', 'venue_organizer_text'].includes(signal),
      );
    });
    if (prose.length > 0) {
      return {
        rootCauseClass: 'G_DESCRIPTION_AS_LINEUP',
        firstFailureStage: '6_connector_parser_description_fallback',
        genericFixClass: 'P0_block_prose_artist_creation',
      };
    }
    return {
      rootCauseClass: 'I_ARTIST_QUALITY_GATE_BYPASSED',
      firstFailureStage: '11_artist_candidate_validation',
      genericFixClass: 'P2_enforce_quality_gate_before_artist_create',
    };
  }

  if (input.collapsedArtistNames.length > 0) {
    return {
      rootCauseClass: 'E_HTML_STRUCTURE_LOST',
      firstFailureStage: '5_html_to_text_normalization',
      genericFixClass: 'P3_flyer_or_structured_billing_repair',
    };
  }

  if (input.titleInferenceArtists.length > 0 && input.structuredEntryCount <= 1) {
    return {
      rootCauseClass: 'H_TITLE_INFERENCE_PROMOTED',
      firstFailureStage: '18_title_inference_fallback',
      genericFixClass: 'P1_demote_title_inference',
    };
  }

  if (input.detailBlocked && input.legacyArtistNames.length === 0 && input.structuredEntryCount === 0) {
    return {
      rootCauseClass: 'C_DETAIL_SOURCE_INACCESSIBLE',
      firstFailureStage: '4_detail_page_fetch',
      genericFixClass: 'P3_flyer_reconciliation_when_blocked',
    };
  }

  if (
    input.flyerEvidencePresent &&
    input.structuredEntryCount === 0 &&
    input.legacyArtistNames.length === 0
  ) {
    return {
      rootCauseClass: 'Q_FLYER_EVIDENCE_REQUIRED',
      firstFailureStage: '14_structured_lineup_merge',
      genericFixClass: 'P3_publish_accepted_flyer_evidence',
    };
  }

  if (input.modelConsistency === 'structured_correct_legacy_wrong') {
    return {
      rootCauseClass: 'M_LEGACY_COMPATIBILITY_CORRUPTION',
      firstFailureStage: '16_event_artists_compatibility_projection',
      genericFixClass: 'P2_sync_compatibility_from_structured',
    };
  }

  if (input.modelConsistency === 'structured_absent_legacy_present') {
    return {
      rootCauseClass: 'L_STRUCTURED_PERSISTENCE_SKIPPED',
      firstFailureStage: '14_structured_lineup_persistence',
      genericFixClass: 'P1_single_structured_writer',
    };
  }

  if (
    input.rawArtistNames.length === 0 &&
    input.legacyArtistNames.length === 0 &&
    input.structuredEntryCount === 0
  ) {
    return {
      rootCauseClass: 'R_SOURCE_NO_LINEUP',
      firstFailureStage: '5_raw_source_payload',
      genericFixClass: 'none_audit_only',
    };
  }

  if (input.modelConsistency === 'fully_aligned' && input.invalidArtistNames.length === 0 && input.collapsedArtistNames.length === 0 && !input.contaminationSuspect) {
    return {
      rootCauseClass: null,
      firstFailureStage: 'none',
      genericFixClass: 'none',
      pipelineHealthy: true,
    };
  }

  return {
    rootCauseClass: 'D_RAW_SOURCE_INSUFFICIENT',
    firstFailureStage: '7_normalized_candidate',
    genericFixClass: 'P1_candidate_only_secondary_paths',
  };
}

export function findCollapsedNames(names: string[]): string[] {
  return names.filter((name) => isCollapsedLineupArtistName(name) || isSuspiciousArtistName(name));
}
