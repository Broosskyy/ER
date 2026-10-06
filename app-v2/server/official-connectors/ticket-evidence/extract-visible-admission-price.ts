import { parseTicketIoDetailDom, type TicketIoDetailDomOffer } from './parse-ticket-io-detail-dom';
import { classifyTicketOffer, isAdmissionOfferRole } from './ticket-offer-role';
import { selectRegularAdmissionOffer } from './select-regular-admission-offer';
import type { EventTicketEvidence, TicketOfferEvidence } from './types';

export interface VisibleTicketProduct {
  productName: string;
  price: string | null;
  amountMinor: number | null;
  currency: string | null;
  admissionClass: string;
  grantsAdmission: boolean;
  available: boolean;
  selectedAsCanonical: boolean;
}

function mapDomOffersToTicketEvidenceOffers(domOffers: TicketIoDetailDomOffer[]): TicketOfferEvidence[] {
  return domOffers.map((offer) => {
    const classification = classifyTicketOffer({
      label: offer.rawLabel,
      category: offer.category,
      description: offer.description,
    });
    return {
      rawLabel: offer.rawLabel,
      normalizedLabel: offer.rawLabel,
      rawPrice: offer.rawPrice,
      amountMinor: offer.amountMinor,
      currency: offer.currency,
      role: classification.role,
      grantsEventEntry: classification.grantsEventEntry,
      requiresBaseTicket: classification.requiresBaseTicket,
      category: offer.category,
      description: offer.description,
      availability: offer.soldOut ? 'sold_out' : offer.purchasable ? 'available' : 'unavailable_unknown',
      confidence: offer.purchasable ? 0.9 : 0.75,
    };
  });
}

export function extractVisibleAdmissionPriceFromTicketIoBody(
  body: string,
  sourceUrl: string,
): {
  amountMinor: number | null;
  productLabel: string | null;
  browserVisibleProducts: VisibleTicketProduct[];
} {
  const dom = parseTicketIoDetailDom(body, { sourceUrl });
  if (!dom || dom.offers.length === 0) {
    return { amountMinor: null, productLabel: null, browserVisibleProducts: [] };
  }

  const offers = mapDomOffersToTicketEvidenceOffers(dom.offers);
  const observedAt = new Date().toISOString();
  const selected = selectRegularAdmissionOffer({
    providerKey: 'ticket_io',
    providerIdentity: {
      providerKey: 'ticket_io',
      providerEventId: 'visible-admission',
      identityKey: 'ticket_io:visible-admission',
    },
    sourceUrl,
    canonicalTicketUrl: sourceUrl,
    sourceObservedAt: observedAt,
    extractedAt: observedAt,
    contentFingerprint: 'visible-admission',
    eventIdentityEvidence: {},
    offers,
    normalizedStatus: 'available',
    statusLabel: 'Tickets verfügbar',
    rejectedOffers: [],
    confidence: 0.9,
  });

  const browserVisibleProducts: VisibleTicketProduct[] = dom.offers.map((offer) => {
    const classification = classifyTicketOffer({
      label: offer.rawLabel,
      category: offer.category,
      description: offer.description,
    });
    return {
      productName: offer.rawLabel,
      price: offer.rawPrice ?? null,
      amountMinor: offer.amountMinor ?? null,
      currency: offer.currency ?? 'EUR',
      admissionClass: classification.role,
      grantsAdmission: classification.grantsEventEntry,
      available: offer.purchasable && !offer.soldOut,
      selectedAsCanonical: selected?.rawLabel === offer.rawLabel,
    };
  });

  const visibleAdmissionPrices = browserVisibleProducts.filter(
    (product) => product.grantsAdmission && product.amountMinor != null && product.available,
  );

  const amountMinor =
    selected?.amountMinor ??
    visibleAdmissionPrices.sort((left, right) => (left.amountMinor ?? 0) - (right.amountMinor ?? 0))[0]
      ?.amountMinor ??
    null;
  const productLabel = selected?.rawLabel ?? visibleAdmissionPrices[0]?.productName ?? null;

  return { amountMinor, productLabel, browserVisibleProducts };
}

export function hasVisibleLiveAdmissionPrice(evidence: EventTicketEvidence | undefined): boolean {
  if (!evidence) {
    return false;
  }
  return evidence.offers.some(
    (offer) =>
      isAdmissionOfferRole(offer.role ?? 'unknown') &&
      offer.amountMinor != null &&
      (offer.availability === 'available' || offer.availability === 'free'),
  );
}
