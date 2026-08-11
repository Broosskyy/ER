import type {
  CanonicalEvent,
  CleanImportDecision,
} from './event-evidence';
import type { IdentityResolution } from './identity-resolver';

export interface ReviewDecisionResult {
  decision: CleanImportDecision;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  reviewReasons: string[];
}

export type MissingLiveEvidenceDisposition =
  | 'live_evidence_present'
  | 'historical_preserve'
  | 'review';

/** Keeps confirmed historical canonical events out of active missing-evidence review. */
export function resolveMissingLiveEvidenceDisposition(input: {
  existingEventId?: string;
  endDate?: string;
  hasLiveEvidence: boolean;
  now: Date;
}): MissingLiveEvidenceDisposition {
  if (input.hasLiveEvidence) {
    return 'live_evidence_present';
  }
  const endTime = input.endDate ? Date.parse(input.endDate) : Number.NaN;
  if (
    input.existingEventId &&
    Number.isFinite(endTime) &&
    endTime < input.now.getTime()
  ) {
    return 'historical_preserve';
  }
  return 'review';
}

function missingRequired(
  canonicalEvent: CanonicalEvent | undefined,
  identity: IdentityResolution,
): string[] {
  if (!canonicalEvent) {
    return identity.reasons.length > 0
      ? identity.reasons
      : ['title_missing', 'start_date_missing', 'venue_missing'];
  }
  const missing: string[] = [];
  if (!canonicalEvent.title.trim()) missing.push('title_missing');
  if (!canonicalEvent.startDate.trim()) missing.push('start_date_missing');
  if (!canonicalEvent.venueName?.trim() && !canonicalEvent.locationText?.trim()) {
    missing.push('venue_missing');
  }
  if (
    identity.identityMode === 'official_website' &&
    !canonicalEvent.websiteUrl?.trim()
  ) {
    missing.push('official_website_missing');
  }
  return missing;
}

function missingOptional(
  canonicalEvent: CanonicalEvent | undefined,
  identity: IdentityResolution,
): string[] {
  if (!canonicalEvent) {
    return [
      'description',
      'genres',
      'lineup',
      'minimumAge',
      'admissionPrice',
      'ticketPhases',
      'endDate',
      'venueEnvironment',
    ];
  }
  const optional: string[] = [
    ...(!canonicalEvent.description ? ['description'] : []),
    ...(!canonicalEvent.genres?.length ? ['genres'] : []),
    ...(!canonicalEvent.lineup?.length && canonicalEvent.lineupState !== 'tba'
      ? ['lineup']
      : []),
    ...(!canonicalEvent.minimumAge ? ['minimumAge'] : []),
    ...(!canonicalEvent.admissionPrice ? ['admissionPrice'] : []),
    ...(!canonicalEvent.ticketPhases?.length ? ['ticketPhases'] : []),
    ...(!canonicalEvent.endDate ? ['endDate'] : []),
    ...(!canonicalEvent.venueEnvironment ? ['venueEnvironment'] : []),
  ];
  if (identity.identityMode === 'ticket_platform' && !canonicalEvent.websiteUrl?.trim()) {
    optional.push('officialWebsite');
  }
  if (identity.identityMode === 'official_website' && !canonicalEvent.ticketUrl?.trim()) {
    optional.push('ticketUrl');
  }
  return optional;
}

export class ReviewDecision {
  decide(
    canonicalEvent: CanonicalEvent | undefined,
    identity: IdentityResolution,
  ): ReviewDecisionResult {
    const missingRequiredFields = missingRequired(canonicalEvent, identity);
    const missingOptionalFields = missingOptional(canonicalEvent, identity);
    const reviewReasons = [...identity.reasons];

    if (identity.verdict === 'duplicate_candidate') {
      return {
        decision: 'duplicate_candidate',
        missingRequiredFields,
        missingOptionalFields,
        reviewReasons,
      };
    }

    if (identity.verdict === 'mismatch') {
      return {
        decision: 'review',
        missingRequiredFields,
        missingOptionalFields,
        reviewReasons,
      };
    }

    if (!canonicalEvent || missingRequiredFields.length > 0) {
      return {
        decision: 'review',
        missingRequiredFields,
        missingOptionalFields,
        reviewReasons: [
          ...reviewReasons,
          ...missingRequiredFields,
        ].filter((value, index, all) => all.indexOf(value) === index),
      };
    }

    if (identity.verdict !== 'exact' && identity.verdict !== 'corroborated') {
      return {
        decision: 'review',
        missingRequiredFields,
        missingOptionalFields,
        reviewReasons,
      };
    }

    return {
      decision: missingOptionalFields.length > 0 ? 'publish_partial' : 'publish',
      missingRequiredFields,
      missingOptionalFields,
      reviewReasons,
    };
  }
}
