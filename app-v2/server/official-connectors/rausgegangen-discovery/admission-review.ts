import type { RausgegangenDetailEvidence } from './types';

export type AdmissionReviewKind =
  | 'free_entry'
  | 'free_until_cutoff'
  | 'door_price_unknown'
  | 'online_offer_needs_identity_verification'
  | 'numeric_offer_without_purchase_target'
  | 'unknown';

export interface AdmissionReviewEvidence {
  kind: AdmissionReviewKind;
  /** An offer is only a source hint; never a verified payable ticket amount. */
  sourcePriceMinor?: number;
  /** May point to a tour page, shop root or another event. NOT purchase-approved. */
  sourceTicketUrl?: string;
  evidenceOrigin: 'event_json_ld_description_or_offer';
  requiresHumanOrProviderVerification: true;
  autoPersistAllowed: false;
}

/**
 * Classifies only the event-specific JSON-LD offer and description.
 * Do not classify page-wide text: global menus, sidebars and other events can
 * advertise free entry or tickets unrelated to this event.
 *
 * This output is diagnostic ONLY. Ticket/event persistence uses its independent
 * identity, price, status, and source-provenance safety gates.
 */
export function classifyRausgegangenAdmissionForReview(
  detail: Pick<RausgegangenDetailEvidence, 'description' | 'ticketPriceMinor' | 'ticketUrl'>,
): AdmissionReviewEvidence {
  const description = detail.description?.replace(/\s+/g, ' ').trim() ?? '';
  const conditionalFree = /\b(?:free\s+(?:entry|admission)|eintritt\s+frei|freier\s+eintritt)\s+(?:til(?:l)?['’]?|until|bis)\s*(?:midnight|mitternacht|\d{1,2}(?:[.:]\d{2})?\s*(?:uhr)?)\b/i;
  const wholeEventFree = /\b(?:eintritt\s+frei|freier\s+eintritt|free\s+(?:admission|entry))\b/i;
  const doorPrice = /\b(?:preis\s+an\s+(?:der\s+)?ak|abendkasse|door\s+price|at\s+the\s+door)\b/i;
  let kind: AdmissionReviewKind = 'unknown';

  if (conditionalFree.test(description)) {
    kind = 'free_until_cutoff';
  } else if (wholeEventFree.test(description) || detail.ticketPriceMinor === 0) {
    kind = 'free_entry';
  } else if (doorPrice.test(description)) {
    kind = 'door_price_unknown';
  } else if (detail.ticketUrl?.startsWith('https://')) {
    kind = 'online_offer_needs_identity_verification';
  } else if (detail.ticketPriceMinor != null) {
    kind = 'numeric_offer_without_purchase_target';
  }

  return {
    kind,
    ...(detail.ticketPriceMinor != null && Number.isFinite(detail.ticketPriceMinor) &&
      detail.ticketPriceMinor >= 0 ? { sourcePriceMinor: detail.ticketPriceMinor } : {}),
    ...(detail.ticketUrl?.startsWith('https://') ? { sourceTicketUrl: detail.ticketUrl } : {}),
    evidenceOrigin: 'event_json_ld_description_or_offer',
    requiresHumanOrProviderVerification: true,
    autoPersistAllowed: false,
  };
}
