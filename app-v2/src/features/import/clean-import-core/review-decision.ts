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

function missingRequired(canonicalEvent: CanonicalEvent | undefined): string[] {
  if (!canonicalEvent) {
    return ['title', 'startDate', 'venueOrLocation', 'websiteUrl', 'stableIdentity'];
  }
  return [
    ...(!canonicalEvent.title.trim() ? ['title'] : []),
    ...(!canonicalEvent.startDate.trim() ? ['startDate'] : []),
    ...(!canonicalEvent.venueName?.trim() && !canonicalEvent.locationText?.trim()
      ? ['venueOrLocation']
      : []),
    ...(!canonicalEvent.websiteUrl.trim() ? ['websiteUrl'] : []),
  ];
}

function missingOptional(canonicalEvent: CanonicalEvent | undefined): string[] {
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
  return [
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
}

export class ReviewDecision {
  decide(
    canonicalEvent: CanonicalEvent | undefined,
    identity: IdentityResolution,
  ): ReviewDecisionResult {
    const missingRequiredFields = missingRequired(canonicalEvent);
    const missingOptionalFields = missingOptional(canonicalEvent);
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
        decision:
          identity.verdict === 'unverifiable' ? 'reject' : 'review',
        missingRequiredFields: [
          ...missingRequiredFields,
          ...(identity.verdict === 'unverifiable' ? ['stableIdentity'] : []),
        ].filter((field, index, all) => all.indexOf(field) === index),
        missingOptionalFields,
        reviewReasons: [
          ...reviewReasons,
          identity.verdict === 'unverifiable'
            ? 'stable_identity_unverifiable'
            : 'required_fields_missing',
        ],
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
