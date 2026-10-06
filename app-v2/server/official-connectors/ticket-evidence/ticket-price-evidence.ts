import type { EventTicketEvidence, TicketPriceEvidence, TicketPriceEvidenceState } from './types';
import { classifyTicketOffer, isAdmissionOfferRole, isGenericPlaceholderOfferLabel, isSelectableRegularAdmission } from './ticket-offer-role';
import { selectRegularAdmissionOffer } from './select-regular-admission-offer';
import { isVerifiedTicketTargetIdentity } from './ticket-target-identity';

export interface HistoricalPriceCapture {
  amountMinor: number;
  currency: string;
  rawPriceText?: string;
  sourceUrl: string;
  sourceObservedAt: string;
  contentFingerprint: string;
  namedProductLabel?: string;
}

export function historicalCaptureHasAdmissionEvidence(capture: HistoricalPriceCapture | undefined): boolean {
  if (!capture?.namedProductLabel || isGenericPlaceholderOfferLabel(capture.namedProductLabel)) {
    return false;
  }
  return isSelectableRegularAdmission(classifyTicketOffer({ label: capture.namedProductLabel }));
}

export interface BuildPriceEvidenceInput {
  ticketEvidence?: EventTicketEvidence;
  providerBlocked?: boolean;
  eventEnded?: boolean;
  saleNotStarted?: boolean;
  soldOut?: boolean;
  presaleRegistration?: boolean;
  targetIdentityEvidence?: import('./types').TicketTargetIdentityEvidence;
  historicalCapture?: HistoricalPriceCapture;
}

export function buildTicketPriceEvidence(input: BuildPriceEvidenceInput): TicketPriceEvidence {
  const base = {
    sourceUrl: input.ticketEvidence?.sourceUrl ?? input.historicalCapture?.sourceUrl ?? '',
    sourceObservedAt: input.ticketEvidence?.sourceObservedAt ?? input.historicalCapture?.sourceObservedAt ?? '',
    contentFingerprint: input.ticketEvidence?.contentFingerprint ?? input.historicalCapture?.contentFingerprint ?? '',
  };

  function historicalCaptureTrusted(): boolean {
    if (!input.historicalCapture || !input.eventEnded) {
      return false;
    }
    if (!historicalCaptureHasAdmissionEvidence(input.historicalCapture)) {
      return false;
    }
    if (!input.targetIdentityEvidence) {
      return true;
    }
    if (isVerifiedTicketTargetIdentity(input.targetIdentityEvidence.identityDecision)) {
      return true;
    }
    if (
      input.targetIdentityEvidence.identityDecision === 'redirected_to_different_event' &&
      input.targetIdentityEvidence.originalUrl === input.historicalCapture.sourceUrl
    ) {
      return true;
    }
    return false;
  }

  if (input.providerBlocked) {
    return {
      state: 'provider_access_unavailable',
      evidenceOrigin: 'provider_detail',
      reason: 'provider_page_blocked',
      ...base,
    };
  }

  if (historicalCaptureTrusted()) {
    return {
      state: 'verified_historical',
      amountMinor: input.historicalCapture!.amountMinor,
      currency: input.historicalCapture!.currency,
      rawPriceText: input.historicalCapture!.rawPriceText,
      evidenceOrigin: 'verified_live_capture',
      sourceUrl: input.historicalCapture!.sourceUrl,
      sourceObservedAt: input.historicalCapture!.sourceObservedAt,
      contentFingerprint: input.historicalCapture!.contentFingerprint,
    };
  }

  const lowest = input.ticketEvidence ? selectRegularAdmissionOffer(input.ticketEvidence) : undefined;
  if (lowest?.amountMinor !== undefined && lowest.currency) {
    const evidenceState = input.eventEnded ? 'verified_historical' : 'verified_current';
    return {
      state: evidenceState,
      amountMinor: lowest.amountMinor,
      currency: lowest.currency,
      rawPriceText: lowest.rawPrice,
      evidenceOrigin: input.ticketEvidence?.contentFingerprint ? 'provider_detail' : 'provider_structured_data',
      ...base,
    };
  }

  const admissionOffers = input.ticketEvidence?.offers.filter((o) => isAdmissionOfferRole(o.role ?? 'unknown_addon')) ?? [];
  if (input.presaleRegistration || input.saleNotStarted || input.ticketEvidence?.normalizedStatus === 'sale_not_started') {
    return {
      state: 'not_yet_published',
      evidenceOrigin: 'provider_detail',
      reason: input.presaleRegistration ? 'presale_registration' : 'sale_not_started',
      ...base,
    };
  }

  if (input.eventEnded || input.ticketEvidence?.normalizedStatus === 'sales_ended') {
    return {
      state: 'no_longer_public',
      evidenceOrigin: 'event_lifecycle',
      reason: 'event_ended',
      ...base,
    };
  }

  if (input.soldOut || input.ticketEvidence?.normalizedStatus === 'sold_out') {
    return {
      state: 'no_longer_public',
      evidenceOrigin: 'provider_detail',
      reason: 'sold_out_without_public_price',
      ...base,
    };
  }

  if (!input.ticketEvidence || admissionOffers.length === 0) {
    return {
      state: 'not_yet_published',
      evidenceOrigin: 'provider_detail',
      reason: 'regular_price_not_exposed_by_provider',
      ...base,
    };
  }

  return {
    state: 'not_yet_published',
    evidenceOrigin: 'provider_detail',
    reason: 'admission_without_price',
    ...base,
  };
}

export function formatConsumerPriceLabel(price: TicketPriceEvidence): string {
  switch (price.state) {
    case 'verified_current':
      return price.rawPriceText ?? `ab ${formatMinorAsEuro(price.amountMinor ?? 0)}`;
    case 'verified_historical':
      return `zuletzt ${price.rawPriceText ?? `ab ${formatMinorAsEuro(price.amountMinor ?? 0)}`}`;
    case 'not_yet_published':
      return 'Preis noch nicht veröffentlicht';
    case 'no_longer_public':
      return 'Verkauf beendet';
    case 'provider_access_unavailable':
      return 'Preis derzeit nicht verifizierbar';
    default:
      return 'Preis derzeit nicht verifizierbar';
  }
}

function formatMinorAsEuro(amountMinor: number): string {
  const amount = amountMinor / 100;
  if (Number.isInteger(amount)) {
    return `${amount} €`;
  }
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function projectConsumerPriceLabel(
  price: TicketPriceEvidence,
  options?: {
    identityResult?: import('./types').TicketIdentityResult;
    identityDecision?: import('./types').TicketTargetIdentityDecision;
    salesStatus?: string | null;
  },
): string {
  if (price.state === 'verified_historical' && price.amountMinor != null) {
    return formatConsumerPriceLabel(price);
  }
  if (
    options?.identityResult === 'ticket_identity_conflict' ||
    options?.identityResult === 'ticket_identity_unverifiable' ||
    options?.identityDecision === 'redirected_to_different_event' ||
    options?.identityDecision === 'identity_unverifiable' ||
    options?.identityDecision === 'stale_ticket_detail'
  ) {
    return 'Ticketlink wird geprüft';
  }
  if (options?.salesStatus === 'availability_unverified') {
    return 'Preis derzeit nicht verifizierbar';
  }
  return formatConsumerPriceLabel(price);
}

export function hasVerifiedPriceAmount(state: TicketPriceEvidenceState): boolean {
  return state === 'verified_current' || state === 'verified_historical';
}
