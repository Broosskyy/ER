/** Root-cause taxonomy for global lineup pipeline audit (Phase 4.6.9 read-only). */
export type LineupRootCauseClass =
  | 'A_WRONG_SOURCE_EVENT_MATCH'
  | 'B_CROSS_EVENT_STATE_LEAKAGE'
  | 'C_DETAIL_SOURCE_INACCESSIBLE'
  | 'D_RAW_SOURCE_INSUFFICIENT'
  | 'E_HTML_STRUCTURE_LOST'
  | 'F_PARSER_WRONG_FIELD'
  | 'G_DESCRIPTION_AS_LINEUP'
  | 'H_TITLE_INFERENCE_PROMOTED'
  | 'I_ARTIST_QUALITY_GATE_BYPASSED'
  | 'J_ARTIST_RESOLUTION_ALIAS_ERROR'
  | 'K_STRUCTURED_MERGE_WRONG_EVIDENCE'
  | 'L_STRUCTURED_PERSISTENCE_SKIPPED'
  | 'M_LEGACY_COMPATIBILITY_CORRUPTION'
  | 'N_API_PROJECTION_MIXED'
  | 'O_CACHE_STALE_WRONG_EVENT'
  | 'P_UI_WRONG_MODEL'
  | 'Q_FLYER_EVIDENCE_REQUIRED'
  | 'R_SOURCE_NO_LINEUP'
  | 'S_LEGACY_HISTORICAL_CORRUPTION';

export type ModelConsistencyClass =
  | 'fully_aligned'
  | 'structured_correct_legacy_wrong'
  | 'structured_wrong_legacy_correct'
  | 'both_wrong'
  | 'structured_absent_legacy_present'
  | 'structured_present_api_omitted'
  | 'api_correct_ui_unknown'
  | 'stale_cache_suspected';

export type TitleInferenceClass =
  | 'valid_solo_billing'
  | 'valid_title_lineup'
  | 'partial_inference_only'
  | 'event_brand_mistaken'
  | 'series_name_mistaken'
  | 'venue_organizer_mistaken'
  | 'invalid_title_fragment';

export type InvalidArtistSignal =
  | 'html_entity'
  | 'html_tag'
  | 'url'
  | 'prose_sentence'
  | 'amenity'
  | 'ticket_admission'
  | 'venue_organizer_text'
  | 'excessive_length'
  | 'collapsed_boundary'
  | 'placeholder_not_rejected';

export interface LineupAuditStage {
  order: number;
  name: string;
  module: string;
  inputShape: string;
  outputShape: string;
  fallbackBehavior: string;
  skipConditions: string;
  mutationBehavior: 'read_only' | 'writes_db' | 'writes_cache';
  provenancePreserved: boolean;
  legacyPath: boolean;
}

export interface InvalidArtistAuditRow {
  artistId: string;
  artistName: string;
  signals: InvalidArtistSignal[];
  linkedEventIds: string[];
  lineupLegacyArtifact: boolean;
  inStructuredEntries: boolean;
  inLegacyEventArtists: boolean;
  likelySourceField?: string;
  likelyParserPath?: string;
  qualityGateBypassed: boolean;
}

export interface EventLineupTraceRow {
  eventId: string;
  title: string;
  startDate?: string;
  venueName?: string;
  organizerName?: string;
  status: string;
  originIds: string[];
  sourceIds: string[];
  sourceConnectors: string[];
  sourceExternalIds: string[];
  sourceUrls: string[];
  imageUrl?: string;
  importRecordIds: string[];
  rawArtistNames: string[];
  rawDescriptionSnippet?: string;
  normalizedArtistNames: string[];
  simulatedLineupEntriesCount: number;
  structuredEntryCount: number;
  structuredBillingRelations: string[];
  structuredArtistNames: string[];
  legacyArtistNames: string[];
  legacyArtistIds: string[];
  apiLineupEntryCount: number;
  apiArtistNames: string[];
  apiLineupEntryArtistNames: string[];
  modelConsistency: ModelConsistencyClass;
  invalidArtistSignals: InvalidArtistSignal[];
  collapsedArtistNames: string[];
  titleInferenceArtists: string[];
  titleInferenceClass?: TitleInferenceClass;
  flyerEvidencePresent: boolean;
  flyerEvidenceReviewState?: string;
  detailBlocked: boolean;
  firstFailureStage: string;
  rootCauseClass: LineupRootCauseClass | null;
  pipelineHealthy: boolean;
  genericFixClass: string;
  requiresMutation: boolean;
  requiresReimport: boolean;
  requiresManualReview: boolean;
  confidence: number;
  contaminationSuspect?: {
    otherEventId: string;
    otherEventTitle: string;
    sharedEvidence: string;
  };
}
