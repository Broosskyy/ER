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
  /** URLs explicitly linked from the matching official event page as ticket destinations. */
  officialOutboundTicketUrls?: string[];
  evidenceUrl?: string;
}

export interface EventEvidenceIdentityGateResult {
  verdict: IdentityPublishVerdict;
  /** May critical ticket fields (price, phases, availability, CTA) be written? */
  criticalFieldsPublishAllowed: boolean;
  match: ReturnType<typeof evaluatePublicIdentityMatch>['match'];
  reason: string;
  diagnostics: string[];
  titleScore: number;
  dateAgrees: boolean;
  venueAgrees: boolean;
  officialPageLinked: boolean;
}

function normalizeUrlForComparison(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function hasOfficialPageTicketLink(input: {
  evidenceUrl?: string;
  officialOutboundTicketUrls?: string[];
}): boolean {
  const evidenceKey = normalizeUrlForComparison(input.evidenceUrl);
  if (!evidenceKey || !input.officialOutboundTicketUrls?.length) {
    return false;
  }
  return input.officialOutboundTicketUrls.some(
    (url) => normalizeUrlForComparison(url) === evidenceKey,
  );
}

function hasExtractedPageIdentity(
  evidence: Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle'>,
): boolean {
  return Boolean(evidence.pageTitle?.trim() || evidence.listRowTitle?.trim());
}

export function evaluateEventEvidenceIdentityGate(
  input: EventEvidenceIdentityGateInput,
): EventEvidenceIdentityGateResult {
  const officialPageLinked = hasOfficialPageTicketLink({
    evidenceUrl: input.evidenceUrl,
    officialOutboundTicketUrls: input.officialOutboundTicketUrls,
  });

  if (!hasExtractedPageIdentity(input.evidence)) {
    return {
      verdict: 'unverifiable',
      criticalFieldsPublishAllowed: false,
      match: 'unverifiable',
      reason: 'no_extracted_page_identity',
      diagnostics: [
        'identity_match:unverifiable',
        'no_extracted_page_identity',
        'url_candidate_not_identity_proof',
        `official_page_linked:${officialPageLinked}`,
      ],
      titleScore: 0,
      dateAgrees: false,
      venueAgrees: false,
      officialPageLinked,
    };
  }

  const identityMatch = evaluatePublicIdentityMatch(input.event, input.evidence);

  const diagnostics = [
    `identity_match:${identityMatch.match}`,
    identityMatch.reason,
    `title_score:${identityMatch.titleScore.toFixed(2)}`,
    `date_agrees:${identityMatch.dateAgrees}`,
    `venue_agrees:${identityMatch.venueAgrees}`,
    `official_page_linked:${officialPageLinked}`,
  ];

  if (identityMatch.match === 'mismatch') {
    return {
      verdict: 'mismatch',
      criticalFieldsPublishAllowed: false,
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
      match: identityMatch.match,
      reason: identityMatch.reason,
      diagnostics,
      titleScore: identityMatch.titleScore,
      dateAgrees: identityMatch.dateAgrees,
      venueAgrees: identityMatch.venueAgrees,
      officialPageLinked,
    };
  }

  // partial — requires corroboration for critical field writes
  const corroborated =
    identityMatch.dateAgrees &&
    identityMatch.venueAgrees &&
    officialPageLinked;

  if (corroborated) {
    return {
      verdict: 'corroborated',
      criticalFieldsPublishAllowed: true,
      match: identityMatch.match,
      reason: 'partial_match_corroborated_by_official_page_link',
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
    match: identityMatch.match,
    reason: 'partial_match_requires_review_without_official_corroboration',
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
