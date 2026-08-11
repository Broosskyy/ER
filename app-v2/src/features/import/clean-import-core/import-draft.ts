import type { CanonicalEvent, CleanImportDecision, EventEvidence } from './event-evidence';
import type { GenreContractResult, GenreEvidenceItem } from './genre-contract';
import type { ImportSubmission, ImportSubmissionKind, ImportSubmitter } from './import-submission';

/** Three simple admin review tracks — no auto-publish in this phase. */
export type ReviewTrack = 'auto_ready' | 'quick_review' | 'conflict_review';

export type FieldGroupConfidence = 'high' | 'medium' | 'low' | 'missing';

export interface DraftDuplicateCandidate {
  eventId: string;
  score?: number;
  reason: string;
  recommendedAction:
    | 'merge_into_existing'
    | 'create_new'
    | 'manual_compare'
    | 'review_duplicate_url_identity';
}

export interface DraftFieldChange {
  field: string;
  previousValue?: string;
  proposedValue?: string;
  highlight: boolean;
}

export interface DraftFieldGroupConfidence {
  identity: FieldGroupConfidence;
  genres: FieldGroupConfidence;
  lineup: FieldGroupConfidence;
  tickets: FieldGroupConfidence;
  description: FieldGroupConfidence;
  image: FieldGroupConfidence;
}

export interface ImportDraftAudit {
  productionMutations: 0;
  rolloutActivated: false;
  persistenceMode: 'dry_run_noop';
  coreDecision: CleanImportDecision;
  provenanceSourceIds: string[];
  duplicateUrlReconciliation?: {
    normalizedUrls: string[];
    clusterIds: string[];
    mode: 'compatible_merge' | 'identity_conflict';
    conflictReasons: string[];
    identitySnapshots: Array<{
      clusterId: string;
      sourceIds: string[];
      title?: string;
      localCalendarDay?: string;
      venue?: string;
      identityVerdict: string;
      verifiedAt: string[];
      officialUrls: string[];
      ticketUrls: string[];
      contributionCount: number;
      evidenceSnapshots: EventEvidence[];
    }>;
  };
}

export interface ImportDraft {
  id: string;
  /** Stable source-native ID, never a guessed canonical event ID. */
  sourceExternalId?: string;
  /** Present only after loading the draft from import_records. */
  persistenceRecordId?: string;
  proposedCanonicalEvent?: CanonicalEvent;
  submissionKind: ImportSubmissionKind;
  submitter: ImportSubmitter;
  sources: Array<{ sourceId: string; sourceFamily: string; sourceUrl: string }>;
  evidence: EventEvidence[];
  reviewTrack: ReviewTrack;
  reviewReasons: string[];
  duplicates: DraftDuplicateCandidate[];
  proposedFieldChanges: DraftFieldChange[];
  missingFields: string[];
  fieldGroupConfidence: DraftFieldGroupConfidence;
  genres: GenreContractResult;
  imageUrl?: string;
  verifiedAt?: string;
  audit: ImportDraftAudit;
  /** Community correction: supplement existing event instead of creating a duplicate. */
  correctionTargetEventId?: string;
  recommendedDuplicateAction?: DraftDuplicateCandidate['recommendedAction'];
}

export interface ReviewTrackDecisionInput {
  coreDecision: CleanImportDecision;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  reviewReasons: string[];
  hasStableIdentity: boolean;
  hasCollision: boolean;
  hasCriticalConflict: boolean;
  hasManualLocks: boolean;
  hasVerifiedEvidence: boolean;
  titleSafe: boolean;
  dateSafe: boolean;
  venueSafe: boolean;
  genreItems: GenreEvidenceItem[];
}

export function decideReviewTrack(input: ReviewTrackDecisionInput): {
  track: ReviewTrack;
  reasons: string[];
} {
  const reasons = [...input.reviewReasons];

  if (
    input.hasCollision ||
    input.hasCriticalConflict ||
    input.coreDecision === 'duplicate_candidate' ||
    input.coreDecision === 'review' ||
    reasons.some((reason) =>
      /mismatch|collision|duplicate|ticket_relationship|critical/i.test(reason),
    )
  ) {
    if (input.hasCollision || input.coreDecision === 'duplicate_candidate') {
      reasons.push('possible_duplicate');
    }
    return {
      track: 'conflict_review',
      reasons: dedupe(reasons),
    };
  }

  if (
    input.hasManualLocks ||
    !input.hasStableIdentity ||
    !input.titleSafe ||
    !input.dateSafe ||
    !input.venueSafe ||
    !input.hasVerifiedEvidence ||
    input.missingRequiredFields.length > 0
  ) {
    if (input.hasManualLocks) reasons.push('manual_locks_present');
    if (!input.hasVerifiedEvidence) reasons.push('verified_evidence_missing');
    return {
      track: 'conflict_review',
      reasons: dedupe([...reasons, ...input.missingRequiredFields]),
    };
  }

  const quickReviewGaps = input.missingOptionalFields.filter((field) =>
    [
      'genres',
      'lineup',
      'description',
      'admissionPrice',
      'ticketPhases',
      'ticketUrl',
      'image',
    ].includes(field),
  );
  const uncertainGenres = input.genreItems.some(
    (item) => item.uncertain || item.confidence === 'low',
  );

  if (quickReviewGaps.length > 0 || uncertainGenres) {
    if (quickReviewGaps.includes('genres') || uncertainGenres) {
      reasons.push('genres_need_review');
    }
    if (quickReviewGaps.includes('lineup')) reasons.push('lineup_optional_missing');
    return {
      track: 'quick_review',
      reasons: dedupe(reasons),
    };
  }

  if (input.coreDecision === 'publish' || input.coreDecision === 'publish_partial') {
    return {
      track: 'auto_ready',
      reasons: dedupe(reasons),
    };
  }

  return { track: 'conflict_review', reasons: dedupe(reasons) };
}

export function buildImportDraft(input: {
  submission: ImportSubmission;
  canonicalEvent?: CanonicalEvent;
  evidence: EventEvidence[];
  coreDecision: CleanImportDecision;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  reviewReasons: string[];
  genres: GenreContractResult;
  duplicates: DraftDuplicateCandidate[];
  proposedFieldChanges: DraftFieldChange[];
  hasStableIdentity: boolean;
  hasCriticalConflict: boolean;
  hasVerifiedEvidence: boolean;
}): ImportDraft {
  const event = input.canonicalEvent;
  // Intentional community corrections are supplements, not identity collisions.
  const hasCollision = input.duplicates.some(
    (entry) => entry.reason !== 'community_correction_target',
  );
  const hasManualLocks = (input.submission.manualLocks?.length ?? 0) > 0;
  const trackDecision = decideReviewTrack({
    coreDecision: input.coreDecision,
    missingRequiredFields: input.missingRequiredFields,
    missingOptionalFields: input.missingOptionalFields,
    reviewReasons: input.reviewReasons,
    hasStableIdentity: input.hasStableIdentity,
    hasCollision,
    hasCriticalConflict: input.hasCriticalConflict,
    hasManualLocks,
    hasVerifiedEvidence: input.hasVerifiedEvidence,
    titleSafe: Boolean(event?.title?.trim()),
    dateSafe: Boolean(event?.startDate?.trim()),
    venueSafe: Boolean(event?.venueName?.trim() || event?.locationText?.trim()),
    genreItems: input.genres.items,
  });

  const missingFields = [
    ...input.missingRequiredFields,
    ...input.missingOptionalFields,
  ].filter((value, index, all) => all.indexOf(value) === index);

  const verifiedAt =
    input.evidence.map((entry) => entry.verifiedAt).find((value) => value?.trim()) ??
    input.submission.submittedAt;

  const payload = input.submission.payload ?? {};
  const correctionTargetEventId = payload.correctionTargetEventId;
  const recommendedDuplicateAction =
    correctionTargetEventId
      ? 'merge_into_existing'
      : input.duplicates[0]?.recommendedAction;

  return {
    id: `draft:${input.submission.id}`,
    sourceExternalId: input.submission.externalId,
    proposedCanonicalEvent: event
      ? {
          ...event,
          genres: input.genres.normalizedLabels.length
            ? input.genres.normalizedLabels
            : event.genres,
        }
      : undefined,
    submissionKind: input.submission.kind,
    submitter: input.submission.submitter,
    sources: input.evidence.map((entry) => ({
      sourceId: entry.sourceId,
      sourceFamily: entry.sourceFamily,
      sourceUrl: entry.sourceUrl,
    })),
    evidence: input.evidence,
    reviewTrack: trackDecision.track,
    reviewReasons: trackDecision.reasons,
    duplicates: correctionTargetEventId
      ? [
          {
            eventId: correctionTargetEventId,
            reason: 'community_correction_target',
            recommendedAction: 'merge_into_existing',
          },
          ...input.duplicates.filter((entry) => entry.eventId !== correctionTargetEventId),
        ]
      : input.duplicates,
    proposedFieldChanges: input.proposedFieldChanges,
    missingFields,
    fieldGroupConfidence: {
      identity: confidenceFromFlags(
        Boolean(event?.title && event.startDate && (event.venueName || event.locationText)),
        input.hasStableIdentity && input.hasVerifiedEvidence,
      ),
      genres: genreGroupConfidence(input.genres),
      lineup: event?.lineup?.length || event?.lineupState === 'tba' ? 'high' : 'missing',
      tickets: event?.ticketUrl || event?.admissionPrice ? 'medium' : 'missing',
      description: event?.description ? 'medium' : 'missing',
      image: payload.imageUrl ? 'medium' : 'missing',
    },
    genres: input.genres,
    imageUrl: payload.imageUrl,
    verifiedAt,
    audit: {
      productionMutations: 0,
      rolloutActivated: false,
      persistenceMode: 'dry_run_noop',
      coreDecision: input.coreDecision,
      provenanceSourceIds: input.evidence.map((entry) => entry.sourceId),
    },
    correctionTargetEventId,
    recommendedDuplicateAction,
  };
}

function genreGroupConfidence(genres: GenreContractResult): FieldGroupConfidence {
  if (!genres.normalizedLabels.length) return 'missing';
  if (genres.uncertainLabels.length) return 'low';
  if (genres.items.every((item) => item.confidence === 'high' || item.confirmed)) return 'high';
  return 'medium';
}

function confidenceFromFlags(present: boolean, strong: boolean): FieldGroupConfidence {
  if (!present) return 'missing';
  return strong ? 'high' : 'medium';
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}
