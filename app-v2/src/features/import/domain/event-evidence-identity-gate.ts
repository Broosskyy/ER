import {
  evaluateOfficialPageTicketCorroboration,
  type OfficialPageIdentityEvidence,
  type SuggestedIdentityCorrection,
} from '@/features/import/domain/official-page-ticket-corroboration';
import { eventDatesNeedTimeOfDayReview, sameCalendarDay } from '@/features/import/matching/matching-utils';
import { evaluatePublicIdentityMatch } from '@/features/import/ticket-platform-identity/identity-match';
import type { EventIdentitySnapshot, PublicIdentityEvidence } from '@/features/import/ticket-platform-identity/types';

export type IdentityPublishVerdict =
  | 'exact'
  | 'corroborated'
  | 'partial_review_only'
  | 'mismatch'
  | 'unverifiable';

export interface EventEvidenceIdentityGateInput {
  event: EventIdentitySnapshot;
  evidence: Pick<
    PublicIdentityEvidence,
    'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'
  >;
  officialEventUrl?: string;
  officialPage?: OfficialPageIdentityEvidence;
  /** URLs explicitly linked from the matching official event page as ticket destinations. */
  officialOutboundTicketUrls?: string[];
  evidenceUrl?: string;
  verifiedAt?: string;
}

export interface EventEvidenceIdentityGateResult {
  verdict: IdentityPublishVerdict;
  /** May critical ticket fields (price, phases, availability, CTA) be written? */
  criticalFieldsPublishAllowed: boolean;
  canonicalIdentityReviewRequired: boolean;
  ticketEvidenceBlocked: boolean;
  threeWayOutcome: string;
  suggestedIdentityCorrections: SuggestedIdentityCorrection[];
  match: ReturnType<typeof evaluatePublicIdentityMatch>['match'];
  reason: string;
  diagnostics: string[];
  titleScore: number;
  dateAgrees: boolean;
  venueAgrees: boolean;
  officialPageLinked: boolean;
}

function hasExtractedPageIdentity(
  evidence: Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle'>,
): boolean {
  return Boolean(evidence.pageTitle?.trim() || evidence.listRowTitle?.trim());
}

function mergeOfficialPageInput(input: EventEvidenceIdentityGateInput): OfficialPageIdentityEvidence | undefined {
  const fromNested = input.officialPage;
  const outbound =
    fromNested?.outboundTicketUrls ??
    input.officialOutboundTicketUrls ??
    undefined;

  if (
    !fromNested?.pageTitle?.trim() &&
    !fromNested?.eventDate?.trim() &&
    !fromNested?.venueName?.trim() &&
    !outbound?.length
  ) {
    return outbound?.length
      ? {
          officialPageUrl: input.officialEventUrl,
          outboundTicketUrls: outbound,
        }
      : undefined;
  }

  return {
    officialPageUrl: fromNested?.officialPageUrl ?? input.officialEventUrl,
    pageTitle: fromNested?.pageTitle,
    eventDate: fromNested?.eventDate,
    venueName: fromNested?.venueName,
    outboundTicketUrls: outbound,
  };
}

export function evaluateEventEvidenceIdentityGate(
  input: EventEvidenceIdentityGateInput,
): EventEvidenceIdentityGateResult {
  const officialPage = mergeOfficialPageInput(input);
  const corroboration = evaluateOfficialPageTicketCorroboration({
    canonical: input.event,
    ticketEvidence: input.evidence,
    officialPage,
    publicTicketPageUrl: input.evidenceUrl,
    verifiedAt: input.verifiedAt,
  });
  const officialPageLinked = corroboration.officialOutboundRelationship.confirmed;

  if (!hasExtractedPageIdentity(input.evidence)) {
    return {
      verdict: 'unverifiable',
      criticalFieldsPublishAllowed: false,
      canonicalIdentityReviewRequired: corroboration.canonicalIdentityReviewRequired,
      ticketEvidenceBlocked: corroboration.ticketEvidenceBlocked,
      threeWayOutcome: corroboration.threeWayOutcome,
      suggestedIdentityCorrections: corroboration.suggestedIdentityCorrections,
      match: 'unverifiable',
      reason: 'no_extracted_page_identity',
      diagnostics: [
        'identity_match:unverifiable',
        'no_extracted_page_identity',
        'url_candidate_not_identity_proof',
        `official_page_linked:${officialPageLinked}`,
        ...corroboration.diagnostics,
      ],
      titleScore: 0,
      dateAgrees: false,
      venueAgrees: false,
      officialPageLinked,
    };
  }

  const identityMatch = evaluatePublicIdentityMatch(input.event, input.evidence, {
    verifiedAt: input.verifiedAt,
    officialOutboundConfirmed: officialPageLinked,
    slugRelationshipConfirmed: officialPageLinked,
  });

  const diagnostics = [
    `identity_match:${identityMatch.match}`,
    identityMatch.reason,
    `title_score:${identityMatch.titleScore.toFixed(2)}`,
    `date_agrees:${identityMatch.dateAgrees}`,
    `venue_agrees:${identityMatch.venueAgrees}`,
    `official_page_linked:${officialPageLinked}`,
    `three_way_outcome:${corroboration.threeWayOutcome}`,
    ...corroboration.diagnostics,
  ];

  if (
    officialPage?.eventDate &&
    input.evidence.eventDate &&
    eventDatesNeedTimeOfDayReview(officialPage.eventDate, input.evidence.eventDate)
  ) {
    diagnostics.push('time_of_day_review:compatible_calendar_day_different_clock_time');
  }

  const blockedBase = {
    canonicalIdentityReviewRequired: corroboration.canonicalIdentityReviewRequired,
    ticketEvidenceBlocked: corroboration.ticketEvidenceBlocked,
    threeWayOutcome: corroboration.threeWayOutcome,
    suggestedIdentityCorrections: corroboration.suggestedIdentityCorrections,
    match: identityMatch.match,
    titleScore: identityMatch.titleScore,
    dateAgrees: identityMatch.dateAgrees,
    venueAgrees: identityMatch.venueAgrees,
    officialPageLinked,
    diagnostics,
  };

  if (corroboration.canonicalIdentityReviewRequired) {
    const outboundTicketFieldsAllowed = Boolean(
      officialPageLinked &&
        input.officialPage?.venueName?.trim() &&
        corroboration.officialVsTicket?.venueAgrees &&
        input.evidence.eventDate?.trim() &&
        input.event.startDate?.trim() &&
        sameCalendarDay(input.event.startDate, input.evidence.eventDate) &&
        identityMatch.match !== 'mismatch',
    );

    if (outboundTicketFieldsAllowed) {
      return {
        ...blockedBase,
        verdict: identityMatch.match === 'exact' ? 'exact' : 'corroborated',
        criticalFieldsPublishAllowed: true,
        reason: 'canonical_identity_review_with_outbound_ticket_confirmed',
        diagnostics: [
          ...diagnostics,
          'canonical_identity_review_required',
          'ticket_fields:allowed_via_official_outbound_exact',
        ],
      };
    }

    return {
      ...blockedBase,
      verdict: 'partial_review_only',
      criticalFieldsPublishAllowed: false,
      reason: 'canonical_identity_review_required',
      diagnostics: [...diagnostics, 'canonical_identity_review_required'],
    };
  }

  if (corroboration.ticketEvidenceBlocked) {
    return {
      ...blockedBase,
      verdict: identityMatch.match === 'mismatch' ? 'mismatch' : 'partial_review_only',
      criticalFieldsPublishAllowed: false,
      reason: corroboration.reason,
      diagnostics: [...diagnostics, 'blocked:ticket_evidence_three_way'],
    };
  }

  if (corroboration.threeWayOutcome === 'all_sources_disagree') {
    return {
      ...blockedBase,
      verdict: 'mismatch',
      criticalFieldsPublishAllowed: false,
      reason: 'all_sources_disagree',
      diagnostics: [...diagnostics, 'blocked:all_sources_disagree'],
    };
  }

  if (
    officialPage &&
    corroboration.officialVsTicket &&
    corroboration.officialOutboundRelationship.confirmed &&
    !corroboration.officialVsTicket.dateAgrees
  ) {
    return {
      ...blockedBase,
      verdict: 'partial_review_only',
      criticalFieldsPublishAllowed: false,
      reason: 'official_page_date_mismatch_with_ticket',
      diagnostics: [...diagnostics, 'blocked:official_ticket_date_mismatch'],
    };
  }

  if (identityMatch.match === 'mismatch') {
    return {
      verdict: 'mismatch',
      criticalFieldsPublishAllowed: false,
      canonicalIdentityReviewRequired: false,
      ticketEvidenceBlocked: corroboration.ticketEvidenceBlocked,
      threeWayOutcome: corroboration.threeWayOutcome,
      suggestedIdentityCorrections: [],
      match: identityMatch.match,
      reason: identityMatch.reason,
      diagnostics,
      titleScore: identityMatch.titleScore,
      dateAgrees: identityMatch.dateAgrees,
      venueAgrees: identityMatch.venueAgrees,
      officialPageLinked,
    };
  }

  if (identityMatch.match === 'unverifiable') {
    return {
      verdict: 'unverifiable',
      criticalFieldsPublishAllowed: false,
      canonicalIdentityReviewRequired: false,
      ticketEvidenceBlocked: false,
      threeWayOutcome: corroboration.threeWayOutcome,
      suggestedIdentityCorrections: [],
      match: identityMatch.match,
      reason: identityMatch.reason,
      diagnostics,
      titleScore: identityMatch.titleScore,
      dateAgrees: identityMatch.dateAgrees,
      venueAgrees: identityMatch.venueAgrees,
      officialPageLinked,
    };
  }

  if (identityMatch.match === 'exact') {
    return {
      verdict: 'exact',
      criticalFieldsPublishAllowed: true,
      canonicalIdentityReviewRequired: false,
      ticketEvidenceBlocked: false,
      threeWayOutcome: corroboration.threeWayOutcome,
      suggestedIdentityCorrections: [],
      match: identityMatch.match,
      reason: identityMatch.reason,
      diagnostics,
      titleScore: identityMatch.titleScore,
      dateAgrees: identityMatch.dateAgrees,
      venueAgrees: identityMatch.venueAgrees,
      officialPageLinked,
    };
  }

  if (corroboration.corroborated) {
    return {
      verdict: 'corroborated',
      criticalFieldsPublishAllowed: true,
      canonicalIdentityReviewRequired: false,
      ticketEvidenceBlocked: false,
      threeWayOutcome: corroboration.threeWayOutcome,
      suggestedIdentityCorrections: [],
      match: identityMatch.match,
      reason: corroboration.reason,
      diagnostics: [...diagnostics, 'corroboration:official_outbound_ticket_link'],
      titleScore: identityMatch.titleScore,
      dateAgrees: identityMatch.dateAgrees,
      venueAgrees: identityMatch.venueAgrees,
      officialPageLinked,
    };
  }

  return {
    verdict: 'partial_review_only',
    criticalFieldsPublishAllowed: false,
    canonicalIdentityReviewRequired: false,
    ticketEvidenceBlocked: corroboration.ticketEvidenceBlocked,
    threeWayOutcome: corroboration.threeWayOutcome,
    suggestedIdentityCorrections: [],
    match: identityMatch.match,
    reason: corroboration.reason || 'partial_match_requires_review_without_official_corroboration',
    diagnostics: [...diagnostics, 'critical_fields_blocked:partial_without_corroboration'],
    titleScore: identityMatch.titleScore,
    dateAgrees: identityMatch.dateAgrees,
    venueAgrees: identityMatch.venueAgrees,
    officialPageLinked,
  };
}

export function isCriticalTicketField(field: string): boolean {
  return (
    field === 'priceText' ||
    field === 'ticketPhases' ||
    field === 'ticketStatus' ||
    field === 'ticketUrl'
  );
}
