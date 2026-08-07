import {
  classifyOutboundTicketLink,
  type ClassifiedOutboundTicketLink,
} from '@/features/aggregation/domain/cross-source-ticket-discovery';
import { extractTicketIoEventSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import {
  evaluatePublicIdentityMatch,
  publicSourcesStructuralAgree,
  type IdentityMatchResult,
} from '@/features/import/ticket-platform-identity/identity-match';
import { compareEventTitleCores, analyzeEventTitleCore } from '@/features/import/matching/event-title-core';
import { sameCalendarDay } from '@/features/import/matching/matching-utils';
import type { EventIdentitySnapshot, PublicIdentityEvidence } from '@/features/import/ticket-platform-identity/types';

export interface OfficialPageIdentityEvidence {
  officialPageUrl?: string;
  pageTitle?: string;
  eventDate?: string;
  venueName?: string;
  outboundTicketUrls?: string[];
}

export interface OfficialOutboundRelationship {
  confirmed: boolean;
  outboundTicketUrl?: string;
  linkClass?: ClassifiedOutboundTicketLink['class'];
  reason: string;
}

export type SuggestedIdentityCorrectionField =
  | 'title'
  | 'venueName'
  | 'startDate'
  | 'publicTicketRelationship';

export interface SuggestedIdentityCorrection {
  field: SuggestedIdentityCorrectionField;
  currentValue?: string;
  suggestedValue?: string;
  reason: string;
}

export type ThreeWayIdentityOutcome =
  | 'all_agree'
  | 'canonical_identity_review_required'
  | 'ticket_evidence_blocked'
  | 'ticket_exact_without_official_corroboration'
  | 'all_sources_disagree'
  | 'insufficient_official_identity'
  | 'corroboration_not_met';

export interface OfficialPageTicketCorroborationInput {
  canonical: EventIdentitySnapshot;
  ticketEvidence: Pick<
    PublicIdentityEvidence,
    'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'
  >;
  officialPage?: OfficialPageIdentityEvidence;
  publicTicketPageUrl?: string;
  verifiedAt?: string;
}

export interface OfficialPageTicketCorroborationResult {
  corroborated: boolean;
  canonicalIdentityReviewRequired: boolean;
  ticketEvidenceBlocked: boolean;
  threeWayOutcome: ThreeWayIdentityOutcome;
  officialOutboundRelationship: OfficialOutboundRelationship;
  officialVsCanonical?: IdentityMatchResult;
  ticketVsCanonical: IdentityMatchResult;
  officialVsTicket?: IdentityMatchResult;
  suggestedIdentityCorrections: SuggestedIdentityCorrection[];
  reason: string;
  diagnostics: string[];
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

function eventSlugFromUrl(url: string): string | undefined {
  const ticketIoSlug = extractTicketIoEventSlug(url);
  if (ticketIoSlug) {
    return ticketIoSlug.toLowerCase();
  }
  const kingsMatch = url.match(/ticketkings\.de\/event\/([a-z0-9-]+)/i);
  return kingsMatch?.[1]?.toLowerCase();
}

function urlsReferToSameTicketEvent(left: string, right: string): boolean {
  const leftKey = normalizeUrlForComparison(left);
  const rightKey = normalizeUrlForComparison(right);
  if (leftKey && rightKey && leftKey === rightKey) {
    return true;
  }
  const leftSlug = eventSlugFromUrl(left);
  const rightSlug = eventSlugFromUrl(right);
  return Boolean(leftSlug && rightSlug && leftSlug === rightSlug);
}

function isEventSpecificOutboundLink(link: ClassifiedOutboundTicketLink): boolean {
  return link.class === 'ticket_io_event' || link.class === 'ticket_kings_event';
}

export function resolveOfficialOutboundRelationship(input: {
  publicTicketPageUrl?: string;
  outboundTicketUrls?: string[];
}): OfficialOutboundRelationship {
  const evidenceUrl = input.publicTicketPageUrl?.trim();
  if (!evidenceUrl) {
    return {
      confirmed: false,
      reason: 'no_public_ticket_page_url',
    };
  }

  const outboundUrls = input.outboundTicketUrls ?? [];
  if (outboundUrls.length === 0) {
    return {
      confirmed: false,
      reason: 'no_official_outbound_ticket_urls',
    };
  }

  for (const rawUrl of outboundUrls) {
    const classified = classifyOutboundTicketLink(rawUrl);
    if (!isEventSpecificOutboundLink(classified)) {
      continue;
    }
    if (urlsReferToSameTicketEvent(classified.url, evidenceUrl)) {
      return {
        confirmed: true,
        outboundTicketUrl: classified.url,
        linkClass: classified.class,
        reason: 'official_outbound_links_exact_ticket_event',
      };
    }
  }

  const hasShopRootOnly = outboundUrls.every((url) => {
    const classified = classifyOutboundTicketLink(url);
    return classified.class === 'ticket_shop_root' || classified.class === 'generic_listing';
  });

  return {
    confirmed: false,
    reason: hasShopRootOnly
      ? 'official_outbound_only_shop_root_or_generic'
      : 'official_outbound_does_not_match_ticket_event',
  };
}

function officialAsIdentityEvidence(
  official: OfficialPageIdentityEvidence,
): Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'> {
  return {
    pageTitle: official.pageTitle,
    listRowTitle: official.pageTitle,
    eventDate: official.eventDate,
    venueName: official.venueName,
  };
}

function officialAsEventSnapshot(official: OfficialPageIdentityEvidence): EventIdentitySnapshot {
  return {
    eventId: 'official-page',
    title: official.pageTitle ?? '',
    startDate: official.eventDate,
    venueName: official.venueName,
  };
}

function hasOfficialPageIdentityFields(official: OfficialPageIdentityEvidence | undefined): boolean {
  return Boolean(
    official?.pageTitle?.trim() || official?.eventDate?.trim() || official?.venueName?.trim(),
  );
}

function hasTicketPageIdentity(
  ticketEvidence: Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle'>,
): boolean {
  return Boolean(ticketEvidence.pageTitle?.trim() || ticketEvidence.listRowTitle?.trim());
}

/** Pair agrees on event identity (title/date/venue); outbound links cannot satisfy this alone. */
export function identityPairAgrees(
  match: IdentityMatchResult,
  options?: {
    leftDate?: string;
    rightDate?: string;
    leftVenue?: string;
    rightVenue?: string;
  },
): boolean {
  if (match.match === 'mismatch' || match.match === 'unverifiable') {
    return false;
  }
  if (match.match === 'exact') {
    return true;
  }

  const leftDate = options?.leftDate?.trim();
  const rightDate = options?.rightDate?.trim();
  const leftVenue = options?.leftVenue?.trim();
  const rightVenue = options?.rightVenue?.trim();

  if (Boolean(leftDate) !== Boolean(rightDate)) {
    return false;
  }
  if (Boolean(leftVenue) !== Boolean(rightVenue)) {
    return false;
  }

  return match.dateAgrees && match.venueAgrees && match.titleScore >= 0.35;
}

function hasOfficialCorroborationFields(official: OfficialPageIdentityEvidence): boolean {
  return Boolean(official.eventDate?.trim() && official.venueName?.trim());
}

function publicSourcesAgree(
  official: OfficialPageIdentityEvidence,
  ticketEvidence: Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'>,
  options?: {
    verifiedAt?: string;
    officialOutboundConfirmed?: boolean;
  },
): IdentityMatchResult {
  return evaluatePublicIdentityMatch(officialAsEventSnapshot(official), ticketEvidence, options);
}

function buildSuggestedIdentityCorrections(input: {
  canonical: EventIdentitySnapshot;
  official: OfficialPageIdentityEvidence;
  ticketEvidence: Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'>;
  officialVsCanonical: IdentityMatchResult;
  ticketVsCanonical: IdentityMatchResult;
  officialVsTicket: IdentityMatchResult;
  publicTicketPageUrl?: string;
  outboundTicketUrl?: string;
}): SuggestedIdentityCorrection[] {
  if (!identityPairAgrees(input.officialVsTicket, {
    leftDate: input.official.eventDate,
    rightDate: input.ticketEvidence.eventDate,
    leftVenue: input.official.venueName,
    rightVenue: input.ticketEvidence.venueName,
  }) &&
    !publicSourcesStructuralAgree(
      { eventDate: input.official.eventDate, venueName: input.official.venueName },
      {
        eventDate: input.ticketEvidence.eventDate,
        venueName: input.ticketEvidence.venueName,
      },
      input.officialVsTicket,
    )) {
    return [];
  }

  const corrections: SuggestedIdentityCorrection[] = [];
  const publicTitle =
    input.official.pageTitle?.trim() ||
    input.ticketEvidence.listRowTitle?.trim() ||
    input.ticketEvidence.pageTitle?.trim();
  const publicVenue =
    input.official.venueName?.trim() || input.ticketEvidence.venueName?.trim();
  const publicDate =
    input.official.eventDate?.trim() || input.ticketEvidence.eventDate?.trim();

  if (
    publicTitle &&
    input.officialVsCanonical.titleScore < 0.55 &&
    input.ticketVsCanonical.titleScore < 0.55 &&
    !compareEventTitleCores(
      analyzeEventTitleCore(input.canonical.title),
      analyzeEventTitleCore(publicTitle),
    ).coresAgree
  ) {
    corrections.push({
      field: 'title',
      currentValue: input.canonical.title,
      suggestedValue: publicTitle,
      reason: 'official_and_ticket_agree_canonical_title_diverges',
    });
  }

  if (
    publicVenue &&
    !input.officialVsCanonical.venueAgrees &&
    !input.ticketVsCanonical.venueAgrees &&
    input.officialVsTicket.venueAgrees
  ) {
    corrections.push({
      field: 'venueName',
      currentValue: input.canonical.venueName,
      suggestedValue: publicVenue,
      reason: 'official_and_ticket_agree_canonical_venue_diverges',
    });
  }

  if (
    publicDate &&
    input.canonical.startDate?.trim() &&
    !sameCalendarDay(input.canonical.startDate, publicDate) &&
    input.officialVsTicket.dateAgrees
  ) {
    corrections.push({
      field: 'startDate',
      currentValue: input.canonical.startDate,
      suggestedValue: publicDate,
      reason: 'official_and_ticket_agree_canonical_date_diverges',
    });
  }

  const canonicalTicketUrl = input.canonical.ticketUrl?.trim();
  const publicTicketUrl = input.publicTicketPageUrl?.trim();
  if (
    publicTicketUrl &&
    canonicalTicketUrl &&
    !urlsReferToSameTicketEvent(canonicalTicketUrl, publicTicketUrl)
  ) {
    corrections.push({
      field: 'publicTicketRelationship',
      currentValue: canonicalTicketUrl,
      suggestedValue: publicTicketUrl,
      reason: 'official_and_ticket_agree_canonical_ticket_url_diverges',
    });
  } else if (
    publicTicketUrl &&
    !canonicalTicketUrl &&
    input.outboundTicketUrl &&
    urlsReferToSameTicketEvent(input.outboundTicketUrl, publicTicketUrl)
  ) {
    corrections.push({
      field: 'publicTicketRelationship',
      currentValue: undefined,
      suggestedValue: publicTicketUrl,
      reason: 'official_and_ticket_confirm_public_ticket_url',
    });
  }

  return corrections;
}

export function evaluateOfficialPageTicketCorroboration(
  input: OfficialPageTicketCorroborationInput,
): OfficialPageTicketCorroborationResult {
  const official = input.officialPage;
  const outbound = resolveOfficialOutboundRelationship({
    publicTicketPageUrl: input.publicTicketPageUrl,
    outboundTicketUrls: official?.outboundTicketUrls,
  });
  const identityOptions = {
    verifiedAt: input.verifiedAt,
    officialOutboundConfirmed: outbound.confirmed,
    slugRelationshipConfirmed: outbound.confirmed,
  };
  const ticketVsCanonical = evaluatePublicIdentityMatch(
    input.canonical,
    input.ticketEvidence,
    identityOptions,
  );

  const diagnostics: string[] = [
    `ticket_vs_canonical:${ticketVsCanonical.match}`,
    `official_outbound:${outbound.confirmed}`,
    outbound.reason,
  ];

  const base: OfficialPageTicketCorroborationResult = {
    corroborated: false,
    canonicalIdentityReviewRequired: false,
    ticketEvidenceBlocked: false,
    threeWayOutcome: 'corroboration_not_met',
    officialOutboundRelationship: outbound,
    ticketVsCanonical,
    suggestedIdentityCorrections: [],
    reason: 'corroboration_not_met',
    diagnostics,
  };

  if (!hasTicketPageIdentity(input.ticketEvidence)) {
    return {
      ...base,
      threeWayOutcome: 'insufficient_official_identity',
      reason: 'no_ticket_page_identity',
      diagnostics: [...diagnostics, 'ticket_page_identity:missing'],
    };
  }

  if (!hasOfficialPageIdentityFields(official)) {
    if (ticketVsCanonical.match === 'exact') {
      return {
        ...base,
        threeWayOutcome: 'ticket_exact_without_official_corroboration',
        reason: 'ticket_exact_without_official_corroboration',
        diagnostics: [...diagnostics, 'official_page_identity:insufficient_for_corroboration'],
      };
    }
    return {
      ...base,
      threeWayOutcome: 'insufficient_official_identity',
      reason: 'no_official_page_identity',
      diagnostics: [...diagnostics, 'official_page_identity:missing'],
    };
  }

  const officialEvidence = officialAsIdentityEvidence(official!);
  const officialVsCanonical = evaluatePublicIdentityMatch(
    input.canonical,
    officialEvidence,
    identityOptions,
  );
  const officialVsTicket = publicSourcesAgree(official!, input.ticketEvidence, identityOptions);

  const canonicalOfficialAgree = identityPairAgrees(officialVsCanonical, {
    leftDate: input.canonical.startDate,
    rightDate: official!.eventDate,
    leftVenue: input.canonical.venueName,
    rightVenue: official!.venueName,
  });
  const officialTicketAgree = identityPairAgrees(officialVsTicket, {
    leftDate: official!.eventDate,
    rightDate: input.ticketEvidence.eventDate,
    leftVenue: official!.venueName,
    rightVenue: input.ticketEvidence.venueName,
  });
  const officialTicketStructuralAgree = publicSourcesStructuralAgree(
    { eventDate: official!.eventDate, venueName: official!.venueName },
    {
      eventDate: input.ticketEvidence.eventDate,
      venueName: input.ticketEvidence.venueName,
    },
    officialVsTicket,
  );
  const canonicalTicketAgree = identityPairAgrees(ticketVsCanonical, {
    leftDate: input.canonical.startDate,
    rightDate: input.ticketEvidence.eventDate,
    leftVenue: input.canonical.venueName,
    rightVenue: input.ticketEvidence.venueName,
  });

  diagnostics.push(
    `three_way:co=${canonicalOfficialAgree}`,
    `three_way:ot=${officialTicketAgree}`,
    `three_way:ot_structural=${officialTicketStructuralAgree}`,
    `three_way:ct=${canonicalTicketAgree}`,
    `official_vs_canonical:${officialVsCanonical.match}`,
    `official_vs_ticket:${officialVsTicket.match}`,
    `official_date_agrees_ticket:${officialVsTicket.dateAgrees}`,
  );

  const suggestedIdentityCorrections = buildSuggestedIdentityCorrections({
    canonical: input.canonical,
    official: official!,
    ticketEvidence: input.ticketEvidence,
    officialVsCanonical,
    ticketVsCanonical,
    officialVsTicket,
    publicTicketPageUrl: input.publicTicketPageUrl,
    outboundTicketUrl: outbound.outboundTicketUrl,
  });

  const withPairs: OfficialPageTicketCorroborationResult = {
    ...base,
    officialVsCanonical,
    officialVsTicket,
    suggestedIdentityCorrections,
  };

  if (
    ticketVsCanonical.match === 'exact' &&
    !hasOfficialCorroborationFields(official!) &&
    !officialTicketAgree
  ) {
    return {
      ...withPairs,
      threeWayOutcome: 'ticket_exact_without_official_corroboration',
      reason: 'ticket_exact_without_official_corroboration',
      diagnostics: [...diagnostics, 'three_way:ticket_exact_without_official_corroboration'],
    };
  }

  if (canonicalOfficialAgree && !officialTicketAgree) {
    return {
      ...withPairs,
      ticketEvidenceBlocked: true,
      threeWayOutcome: 'ticket_evidence_blocked',
      reason: 'ticket_evidence_blocked_canonical_official_agree',
      diagnostics: [
        ...diagnostics,
        'three_way:ticket_evidence_blocked',
        'blocked:ticket_conflicts_with_canonical_and_official',
      ],
    };
  }

  if (officialTicketAgree && !canonicalTicketAgree) {
    return {
      ...withPairs,
      canonicalIdentityReviewRequired: true,
      threeWayOutcome: 'canonical_identity_review_required',
      reason: 'canonical_identity_review_required',
      diagnostics: [
        ...diagnostics,
        'canonical_identity_review_required',
        ...suggestedIdentityCorrections.map((entry) => `identity_correction:${entry.field}`),
      ],
    };
  }

  if (officialTicketStructuralAgree && !canonicalTicketAgree) {
    return {
      ...withPairs,
      canonicalIdentityReviewRequired: true,
      threeWayOutcome: 'canonical_identity_review_required',
      reason: 'canonical_identity_review_required',
      diagnostics: [
        ...diagnostics,
        'canonical_identity_review_required',
        'three_way:official_ticket_structural_agree',
        ...suggestedIdentityCorrections.map((entry) => `identity_correction:${entry.field}`),
      ],
    };
  }

  if (officialTicketStructuralAgree && !canonicalOfficialAgree) {
    return {
      ...withPairs,
      canonicalIdentityReviewRequired: true,
      threeWayOutcome: 'canonical_identity_review_required',
      reason: 'canonical_identity_review_required',
      diagnostics: [
        ...diagnostics,
        'canonical_identity_review_required',
        'three_way:official_ticket_structural_agree',
        ...suggestedIdentityCorrections.map((entry) => `identity_correction:${entry.field}`),
      ],
    };
  }

  if (!canonicalOfficialAgree && !officialTicketAgree && !canonicalTicketAgree) {
    return {
      ...withPairs,
      ticketEvidenceBlocked: ticketVsCanonical.match === 'mismatch',
      threeWayOutcome: 'all_sources_disagree',
      reason: 'all_sources_disagree',
      diagnostics: [...diagnostics, 'three_way:all_sources_disagree'],
    };
  }

  if (officialVsTicket.match === 'mismatch' || !officialVsTicket.dateAgrees) {
    return {
      ...withPairs,
      reason: officialVsTicket.dateAgrees
        ? 'official_page_ticket_identity_mismatch'
        : 'official_page_date_mismatch_with_ticket',
      diagnostics: [
        ...diagnostics,
        officialVsTicket.dateAgrees
          ? 'blocked:official_ticket_identity_mismatch'
          : 'blocked:official_ticket_date_mismatch',
      ],
    };
  }

  if (ticketVsCanonical.match === 'mismatch') {
    return {
      ...withPairs,
      ticketEvidenceBlocked: true,
      reason: ticketVsCanonical.reason,
      diagnostics: [...diagnostics, 'blocked:ticket_canonical_mismatch'],
    };
  }

  if (canonicalOfficialAgree && officialTicketAgree && canonicalTicketAgree) {
    if (!input.verifiedAt?.trim()) {
      return {
        ...withPairs,
        threeWayOutcome: 'all_agree',
        reason: 'corroboration_requires_verified_at',
        diagnostics: [...diagnostics, 'verified_at:missing'],
      };
    }

    if (ticketVsCanonical.match === 'exact') {
      return {
        ...withPairs,
        threeWayOutcome: 'all_agree',
        reason: 'three_way_all_agree_exact',
        diagnostics: [...diagnostics, 'three_way:all_agree'],
      };
    }

    if (outbound.confirmed) {
      return {
        ...withPairs,
        corroborated: true,
        threeWayOutcome: 'all_agree',
        reason: 'partial_ticket_corroborated_by_official_page_link',
        diagnostics: [...diagnostics, 'three_way:all_agree', 'corroboration:official_outbound_ticket_link'],
      };
    }

    return {
      ...withPairs,
      threeWayOutcome: 'all_agree',
      reason: outbound.reason,
      diagnostics: [...diagnostics, 'three_way:all_agree_without_outbound'],
    };
  }

  return withPairs;
}
