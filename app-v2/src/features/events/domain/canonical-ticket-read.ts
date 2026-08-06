import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalTicketSnapshot } from '@/features/events/domain/canonical-ticket-domain';
import {
  TICKET_CTA_LABELS_DE,
  type TicketAcceptanceState,
  type TicketDestinationClass,
} from '@/features/events/domain/canonical-ticket-domain';
import {
  selectCanonicalTicket,
  type TicketUrlCandidate,
} from '@/features/events/domain/canonical-ticket-selection';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import type { AdminEventTicketStatus } from '@/features/import/domain/canonical-ticket-phase';

export interface CanonicalTicketReadInput {
  ticketUrl?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  priceText?: string;
  ticketStatus?: AdminEventTicketStatus;
  ticketPhases?: CanonicalTicketPhase[];
  salesStartAt?: string;
  salesEndAt?: string;
  extraUrlCandidates?: TicketUrlCandidate[];
  detailBlocked?: boolean;
}

export interface CanonicalTicketReadResult extends CanonicalTicketSnapshot {
  ctaLabel?: string;
  hasActiveCta: boolean;
  acceptanceState: TicketAcceptanceState;
}

function collectUrlCandidates(input: CanonicalTicketReadInput): {
  purchase: TicketUrlCandidate[];
  fallback: TicketUrlCandidate[];
  checkoutEvidence: TicketUrlCandidate[];
} {
  const purchase: TicketUrlCandidate[] = [];
  const fallback: TicketUrlCandidate[] = [];
  const checkoutEvidence: TicketUrlCandidate[] = [];

  const push = (url: string | undefined, bucket: TicketUrlCandidate[], field: string) => {
    const text = meaningfulEventText(url);
    if (!text) {
      return;
    }
    const classified = classifyTicketDestination(text);
    const candidate = { url: text, field, confidence: 1 };
    if (classified.destinationClass === 'embedded_checkout_evidence') {
      checkoutEvidence.push(candidate);
      return;
    }
    bucket.push(candidate);
  };

  push(input.ticketUrl, purchase, 'ticketUrl');
  for (const candidate of input.extraUrlCandidates ?? []) {
    if (candidate.field === 'websiteUrl' || candidate.field === 'officialEventUrl') {
      continue;
    }
    const classified = classifyTicketDestination(candidate.url);
    if (classified.destinationClass === 'embedded_checkout_evidence') {
      checkoutEvidence.push(candidate);
      continue;
    }
    purchase.push(candidate);
  }

  for (const phase of input.ticketPhases ?? []) {
    push(phase.purchaseUrl, purchase, 'ticketPhases.purchaseUrl');
  }

  return { purchase, fallback, checkoutEvidence };
}

export function classifyTicketAcceptanceState(
  snapshot: CanonicalTicketSnapshot,
  input?: { hadBetterCandidate?: boolean },
): TicketAcceptanceState {
  if (snapshot.reviewRequired) {
    return 'review_required';
  }
  if (snapshot.detailBlocked && !snapshot.publicCtaUrl) {
    return 'external_detail_blocked';
  }
  if (!snapshot.publicCtaUrl && !snapshot.officialEventUrl) {
    return 'source_has_no_ticket_data';
  }
  if (input?.hadBetterCandidate && snapshot.destinationClass === 'ticket_platform_root') {
    return 'incorrect';
  }
  if (input?.hadBetterCandidate && snapshot.destinationClass === 'organizer_or_venue_homepage') {
    return 'incorrect';
  }

  switch (snapshot.destinationClass) {
    case 'direct_purchase':
      return 'direct_purchase_correct';
    case 'ticket_platform_event':
      return 'ticket_event_page_correct';
    case 'official_event_page':
      return snapshot.purchaseUrl ? 'ticket_event_page_correct' : 'official_event_page_only';
    case 'ticket_platform_root':
      return 'shop_root_fallback_only';
    case 'ticket_platform_listing':
      return 'listing_fallback_only';
    case 'organizer_or_venue_homepage':
      return snapshot.purchaseUrl ? 'incorrect' : 'official_event_page_only';
    case 'redirect_or_tracking':
      return snapshot.purchaseUrl ? 'direct_purchase_correct' : 'ticket_event_page_correct';
    default:
      return snapshot.publicCtaUrl ? 'review_required' : 'source_has_no_ticket_data';
  }
}

export function readCanonicalTicket(input: CanonicalTicketReadInput): CanonicalTicketReadResult {
  const { purchase, fallback, checkoutEvidence } = collectUrlCandidates(input);
  const officialEventUrl = input.websiteUrl ?? input.sourceUrl;
  const hadBetterCandidate = purchase.some((candidate) => {
    const classified = classifyTicketDestination(candidate.url);
    return (
      classified.destinationClass === 'direct_purchase' ||
      classified.destinationClass === 'ticket_platform_event'
    );
  });

  const snapshot = selectCanonicalTicket({
    officialEventUrl,
    purchaseCandidates: purchase,
    fallbackCandidates: fallback,
    checkoutEvidenceCandidates: checkoutEvidence,
    priceText: input.priceText,
    ticketStatus: input.ticketStatus,
    ticketPhases: input.ticketPhases,
    salesStartAt: input.salesStartAt,
    salesEndAt: input.salesEndAt,
    detailBlocked: input.detailBlocked,
  });

  const ctaLabel = TICKET_CTA_LABELS_DE[snapshot.destinationClass];
  const hasActiveCta = Boolean(snapshot.publicCtaUrl && ctaLabel);

  return {
    ...snapshot,
    ctaLabel,
    hasActiveCta,
    acceptanceState: classifyTicketAcceptanceState(snapshot, { hadBetterCandidate }),
  };
}

export function readCanonicalTicketFromAdminEvent(
  event: AdminEventRecord,
  extras?: Omit<CanonicalTicketReadInput, keyof AdminEventRecord>,
): CanonicalTicketReadResult {
  return readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
    ...extras,
  });
}

export function resolvePublicTicketUrl(snapshot: CanonicalTicketReadResult): string | undefined {
  return snapshot.publicCtaUrl;
}

export function resolveOfficialEventUrl(snapshot: CanonicalTicketReadResult): string | undefined {
  return snapshot.officialEventUrl;
}

export function resolveTicketDestinationClass(
  snapshot: CanonicalTicketReadResult,
): TicketDestinationClass {
  return snapshot.destinationClass;
}
