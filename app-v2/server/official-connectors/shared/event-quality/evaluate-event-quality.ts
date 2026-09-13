import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { EventCompletenessEntry } from '../../ticket-evidence/network-discovery/event-completeness-audit';
import type { GenreCoverageEntry } from '../../ticket-evidence/network-discovery/genre-coverage-audit';
import type { DiscoverySignalBundle } from '../discovery-genre-fusion/types';
import type {
  EventQualityEvaluation,
  EventQualityState,
  FieldQualityAssessment,
  QualityRequirementClass,
} from './types';

export interface EventQualityCandidate {
  event: StagingEventSnapshot;
  discovery?: DiscoverySignalBundle;
  genreCoverage?: GenreCoverageEntry;
  completeness?: EventCompletenessEntry;
}

function fieldAssessment(input: {
  requirementClass: QualityRequirementClass;
  verified: boolean;
  partial?: boolean;
  invalid?: boolean;
  review?: boolean;
  provenance?: boolean;
  reason?: string;
}): FieldQualityAssessment {
  const state = input.invalid
    ? 'INVALID'
    : input.review
      ? 'REVIEW'
      : input.verified
        ? 'VERIFIED'
        : input.partial
          ? 'PARTIAL'
          : 'MISSING';
  return {
    requirementClass: input.requirementClass,
    state,
    valuePresent: input.verified || Boolean(input.partial),
    provenancePresent: Boolean(input.provenance),
    reason: input.reason,
  };
}

function deriveQualityState(input: {
  reviewReasons: string[];
  blocked: boolean;
  warnings: boolean;
}): EventQualityState {
  if (input.blocked) {
    return 'REJECTED';
  }
  if (input.reviewReasons.length > 0) {
    return 'REVIEW_REQUIRED';
  }
  if (input.warnings) {
    return 'READY_WITH_WARNINGS';
  }
  return 'READY';
}

export function evaluateEventQuality(input: EventQualityCandidate): EventQualityEvaluation {
  const { event } = input;
  const discovery = input.discovery;
  const genreEntry = input.genreCoverage;
  const completeness = input.completeness;
  const reviewReasons: string[] = [];

  const domainClassification = discovery?.domainClassification ?? 'AMBIGUOUS';
  if (domainClassification === 'AMBIGUOUS') {
    reviewReasons.push('domain_ambiguous');
  }
  if (discovery?.importQualification === 'WEAK_IMPORT_QUALIFICATION') {
    reviewReasons.push('weak_import_qualification');
  }

  const genreVerified = (genreEntry?.currentGenres.length ?? event.genres.length) > 0;
  const genreReview =
    genreEntry?.classification === 'GENRE_CONFLICT_REVIEW' ||
    genreEntry?.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE';

  const ticketInvalid =
    completeness?.fields.ticketUrl.state === 'INVALID' ||
    completeness?.fields.ticketUrl.state === 'CONFLICT_REVIEW';

  if (ticketInvalid) {
    reviewReasons.push('unsafe_or_invalid_ticket_target');
  }
  if (genreReview && !genreVerified) {
    reviewReasons.push('genre_unresolved');
  }

  const lineupState = completeness?.fields.lineup.state;
  const lineupVerified = lineupState === 'VERIFIED_COMPLETE' || lineupState === 'VERIFIED_PARTIAL';
  const lineupReview = lineupState === 'CONFLICT_REVIEW';

  const identityVerified = Boolean(event.title?.trim() && event.startsAt && event.venueName?.trim());
  const blocked = !identityVerified;

  const provenance = event.sources.map((source) => ({
    field: 'source_binding',
    sourceReference: source.sourceUrl ?? source.sourceEventKey ?? event.eventId,
    authority: source.connectorId ?? source.sourceRole,
  }));

  const warnings =
    !genreVerified ||
    completeness?.fields.description.state === 'UNRESOLVED_NO_EVIDENCE' ||
    completeness?.fields.media.state === 'UNRESOLVED_NO_EVIDENCE';

  const evaluation: EventQualityEvaluation = {
    domain: {
      classification: domainClassification,
      state: fieldAssessment({
        requirementClass: 'REQUIRED_FOR_PUBLICATION',
        verified: domainClassification === 'ELECTRONIC_HIGH' || domainClassification === 'ELECTRONIC_MEDIUM',
        review: domainClassification === 'AMBIGUOUS',
        provenance: Boolean(discovery),
        reason: discovery?.relevance.reasons.join(';'),
      }),
    },
    identity: fieldAssessment({
      requirementClass: 'REQUIRED_FOR_PUBLICATION',
      verified: identityVerified,
      invalid: !event.title?.trim() || !event.startsAt,
      provenance: event.sources.length > 0,
    }),
    completeness: fieldAssessment({
      requirementClass: 'REQUIRED_FOR_PUBLICATION',
      verified: identityVerified && genreVerified,
      partial: identityVerified && !genreVerified,
      reason: completeness?.readiness,
    }),
    genre: {
      state: fieldAssessment({
        requirementClass: 'REQUIRED_FOR_PUBLICATION',
        verified: genreVerified,
        review: genreReview,
        provenance: genreVerified,
        reason: genreEntry?.reason,
      }),
      genres: genreEntry?.currentGenres ?? event.genres,
      confidence: genreEntry?.confidenceBand ?? 'UNRESOLVED',
      coverageEligible: domainClassification !== 'NON_ELECTRONIC',
    },
    lineup: fieldAssessment({
      requirementClass: 'REQUIRED_IF_EVIDENCE_EXISTS',
      verified: lineupVerified,
      review: lineupReview,
      reason: completeness?.fields.lineup.reason,
    }),
    ticket: fieldAssessment({
      requirementClass: 'REQUIRED_IF_EVIDENCE_EXISTS',
      verified: completeness?.fields.ticketUrl.state === 'VERIFIED_COMPLETE',
      invalid: ticketInvalid,
      reason: completeness?.fields.ticketUrl.reason,
    }),
    media: fieldAssessment({
      requirementClass: 'BEST_EFFORT',
      verified: completeness?.fields.media.state === 'VERIFIED_COMPLETE',
      reason: 'event_media_qualification',
    }),
    description: fieldAssessment({
      requirementClass: 'BEST_EFFORT',
      verified: completeness?.fields.description.state === 'VERIFIED_COMPLETE',
      invalid: completeness?.fields.description.state === 'INVALID',
      reason: completeness?.fields.description.reason,
    }),
    qualityState: deriveQualityState({ reviewReasons, blocked, warnings }),
    reviewReasons,
    provenance,
    readiness: completeness?.readiness ?? 'PARTIAL',
  };

  return evaluation;
}

export function publishedElectronicGenreCoverage(
  evaluations: EventQualityEvaluation[],
): number {
  const eligible = evaluations.filter((entry) => entry.genre.coverageEligible);
  if (eligible.length === 0) {
    return 0;
  }
  const classified = eligible.filter((entry) => entry.genre.genres.length > 0);
  return classified.length / eligible.length;
}
