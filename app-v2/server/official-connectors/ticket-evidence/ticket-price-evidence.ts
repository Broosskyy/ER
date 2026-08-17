import type { EventTicketEvidence, TicketOfferEvidence, TicketPriceEvidence, TicketPriceEvidenceState } from './types';
import { isAdmissionOfferRole } from './ticket-offer-role';
import { lowestAdmissionOffer } from './ticket-io-evidence-provider';

export interface BuildPriceEvidenceInput {
  ticketEvidence?: EventTicketEvidence;
  providerBlocked?: boolean;
  eventEnded?: boolean;
  saleNotStarted?: boolean;
  soldOut?: boolean;
  presaleRegistration?: boolean;
  historicalCapture?: {
    amountMinor: number;
    currency: string;
    rawPriceText?: string;
    sourceUrl: string;
    sourceObservedAt: string;
    contentFingerprint: string;
  };
}

export function buildTicketPriceEvidence(input: BuildPriceEvidenceInput): TicketPriceEvidence {
  const base = {
    sourceUrl: input.ticketEvidence?.sourceUrl ?? input.historicalCapture?.sourceUrl ?? '',
    sourceObservedAt: input.ticketEvidence?.sourceObservedAt ?? input.historicalCapture?.sourceObservedAt ?? '',
    contentFingerprint: input.ticketEvidence?.contentFingerprint ?? input.historicalCapture?.contentFingerprint ?? '',
  };

  if (input.providerBlocked) {
    return {
      state: 'provider_access_unavailable',
      evidenceOrigin: 'provider_detail',
      reason: 'provider_page_blocked',
      ...base,
    };
  }

  if (input.historicalCapture && input.eventEnded) {
    return {
      state: 'verified_historical',
      amountMinor: input.historicalCapture.amountMinor,
      currency: input.historicalCapture.currency,
      rawPriceText: input.historicalCapture.rawPriceText,
      evidenceOrigin: 'verified_live_capture',
      sourceUrl: input.historicalCapture.sourceUrl,
      sourceObservedAt: input.historicalCapture.sourceObservedAt,
      contentFingerprint: input.historicalCapture.contentFingerprint,
    };
  }

  if (input.historicalCapture && !input.ticketEvidence?.offers.some((o) => isAdmissionOfferRole(o.role ?? 'unknown_addon') && o.amountMinor !== undefined)) {
    return {
      state: 'verified_historical',
      amountMinor: input.historicalCapture.amountMinor,
      currency: input.historicalCapture.currency,
      rawPriceText: input.historicalCapture.rawPriceText,
      evidenceOrigin: 'verified_live_capture',
      sourceUrl: input.historicalCapture.sourceUrl,
      sourceObservedAt: input.historicalCapture.sourceObservedAt,
      contentFingerprint: input.historicalCapture.contentFingerprint,
    };
  }

  const lowest = input.ticketEvidence ? lowestAdmissionOffer(input.ticketEvidence) : undefined;
  if (lowest?.amountMinor !== undefined && lowest.currency) {
    return {
      state: 'verified_current',
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
      state: 'provider_access_unavailable',
      evidenceOrigin: 'provider_detail',
      reason: 'no_admission_evidence',
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

export function hasVerifiedPriceAmount(state: TicketPriceEvidenceState): boolean {
  return state === 'verified_current' || state === 'verified_historical';
}

export function formatConsumerPriceLabel(price: TicketPriceEvidence): string {
  switch (price.state) {
    case 'verified_current':
      return price.rawPriceText ?? `ab ${(price.amountMinor ?? 0) / 100} ${price.currency ?? 'EUR'}`;
    case 'verified_historical':
      return `zuletzt ${price.rawPriceText ?? `ab ${((price.amountMinor ?? 0) / 100).toFixed(2).replace('.', ',')} ${price.currency ?? 'EUR'}`}`;
    case 'not_yet_published':
      return 'Preis noch nicht veröffentlicht';
    case 'no_longer_public':
      return 'Preis nicht mehr öffentlich';
    case 'provider_access_unavailable':
      return 'Preis beim Anbieter prüfen';
    default:
      return 'Preis beim Anbieter prüfen';
  }
}
