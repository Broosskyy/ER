import { classifyTicketOffer, isAdmissionOfferRole } from '../ticket-offer-role';
import type { TicketIoDetailDomOffer } from '../parse-ticket-io-detail-dom';
import { selectRegularAdmissionOfferWithAudit } from '../select-regular-admission-offer';
import type { EventTicketEvidence, TicketOfferEvidence } from '../types';
import type {
  EnrichedTicketProduct,
  TicketActionState,
  TicketAvailabilityState,
  TicketProductCategory,
} from './detail-types';

const REGISTRATION_PATTERN = /\b(?:pre[-\s]?registration|vorregistrierung|register|anmeldung)\b/i;
const WAITLIST_PATTERN = /\b(?:wait\s*list|warteliste)\b/i;
const DOOR_PATTERN = /\b(?:doorsale|door\s*sale|abendkasse)\b/i;

function mapOfferRoleToCategory(role: string, label: string): TicketProductCategory {
  const text = `${role} ${label}`.toLowerCase();
  if (role === 'table' || /\bvip\b/i.test(text)) {
    return 'VIP_ADMISSION';
  }
  if (isAdmissionOfferRole(role) || role === 'regular_admission') {
    return 'ADMISSION';
  }
  if (/\blocker\b/i.test(text)) {
    return 'LOCKER';
  }
  if (/\bparking\b|\bparken\b/i.test(text)) {
    return 'PARKING';
  }
  if (/\bmerch\b|\bt-?shirt\b|\bhoodie\b/i.test(text)) {
    return 'MERCH';
  }
  if (REGISTRATION_PATTERN.test(text)) {
    return 'REGISTRATION';
  }
  if (role === 'upgrade' || role === 'unknown_addon' || role === 'other_addon') {
    return 'ADD_ON';
  }
  return 'UNKNOWN';
}

function mapAvailability(offer: TicketIoDetailDomOffer): TicketAvailabilityState {
  if (offer.soldOut) {
    return 'SOLD_OUT';
  }
  if (REGISTRATION_PATTERN.test(offer.rawLabel)) {
    return 'REGISTRATION_ONLY';
  }
  if (SALE_NOT_STARTED(offer)) {
    return 'NOT_YET_ON_SALE';
  }
  if (offer.purchasable) {
    return 'AVAILABLE';
  }
  return 'UNKNOWN';
}

function SALE_NOT_STARTED(offer: TicketIoDetailDomOffer): boolean {
  return /\b(?:not\s+on\s+sale|verkaufsstart|sale\s+starts)\b/i.test(
    `${offer.rawLabel} ${offer.description ?? ''}`,
  );
}

function domOffersToTicketEvidence(
  offers: TicketIoDetailDomOffer[],
  sourceUrl: string,
): TicketOfferEvidence[] {
  return offers.map((offer) => {
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

export function enumerateTicketProducts(
  offers: TicketIoDetailDomOffer[],
  sourceUrl: string,
): {
  products: EnrichedTicketProduct[];
  currentAdmissionPriceMinor?: number;
  currentAdmissionPhase?: string;
  currentAdmissionLabel?: string;
  ticketAvailability: TicketAvailabilityState;
  ticketAction: TicketActionState;
} {
  const ticketOffers = domOffersToTicketEvidence(offers, sourceUrl);
  const evidence: EventTicketEvidence = {
    providerKey: 'ticket_io',
    providerIdentity: {
      providerKey: 'ticket_io',
      providerEventId: 'detail',
      identityKey: 'ticket_io:detail',
    },
    sourceUrl,
    canonicalTicketUrl: sourceUrl,
    sourceObservedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
    contentFingerprint: 'detail-enrichment',
    eventIdentityEvidence: {},
    offers: ticketOffers,
    normalizedStatus: 'available',
    statusLabel: 'Tickets verfügbar',
    rejectedOffers: [],
    confidence: 0.9,
  };

  const selection = selectRegularAdmissionOfferWithAudit(evidence);
  const selectedLabel = selection.selected?.rawLabel ?? selection.selected?.normalizedLabel;

  const products: EnrichedTicketProduct[] = offers.map((offer) => {
    const classification = classifyTicketOffer({
      label: offer.rawLabel,
      category: offer.category,
      description: offer.description,
    });
    const category = mapOfferRoleToCategory(classification.role, offer.rawLabel);
    return {
      label: offer.rawLabel,
      category,
      rawPrice: offer.rawPrice,
      amountMinor: offer.amountMinor,
      currency: offer.currency,
      phaseLabel: offer.rawLabel,
      availability: mapAvailability(offer),
      soldOut: offer.soldOut,
      purchasable: offer.purchasable,
      grantsAdmission: classification.grantsEventEntry,
      selectedAsCurrentAdmission: Boolean(selectedLabel && offer.rawLabel === selectedLabel),
    };
  });

  const admissionProducts = products.filter((product) => product.category === 'ADMISSION');
  const anySoldOut = admissionProducts.every((product) => product.soldOut);
  const anyRegistration = products.some((product) => product.category === 'REGISTRATION' && product.purchasable);
  const anyWaitlist = products.some((product) => WAITLIST_PATTERN.test(product.label));
  const anyDoor = products.some((product) => DOOR_PATTERN.test(product.label) && product.purchasable);

  let ticketAvailability: TicketAvailabilityState = 'UNKNOWN';
  if (anySoldOut && admissionProducts.length > 0) {
    ticketAvailability = 'SOLD_OUT';
  } else if (selection.selected) {
    ticketAvailability = 'AVAILABLE';
  } else if (products.some((product) => product.availability === 'NOT_YET_ON_SALE')) {
    ticketAvailability = 'NOT_YET_ON_SALE';
  } else if (anyRegistration) {
    ticketAvailability = 'REGISTRATION_ONLY';
  }

  let ticketAction: TicketActionState = 'NONE';
  if (selection.selected?.amountMinor != null && selection.selected.availability === 'available') {
    ticketAction = 'PURCHASE';
  } else if (anyRegistration) {
    ticketAction = 'PRE_REGISTER';
  } else if (anyWaitlist) {
    ticketAction = 'WAITLIST';
  } else if (anyDoor) {
    ticketAction = 'DOOR_ONLY';
  }

  return {
    products,
    currentAdmissionPriceMinor: selection.selected?.amountMinor ?? undefined,
    currentAdmissionPhase: selection.selected?.phaseLabel ?? selection.selected?.rawLabel,
    currentAdmissionLabel: selection.selected?.rawLabel,
    ticketAvailability,
    ticketAction,
  };
}

export function mapOfferCategoryForTest(role: string, label: string): TicketProductCategory {
  return mapOfferRoleToCategory(role, label);
}
