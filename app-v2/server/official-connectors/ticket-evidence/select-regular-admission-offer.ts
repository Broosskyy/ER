import type { EventTicketEvidence, TicketOfferEvidence } from './types';
import {
  classifyTicketOffer,
  isAdmissionOfferRole,
  isGenericPlaceholderOfferLabel,
  isSelectableRegularAdmission,
  normalizeOfferRole,
  rejectionReasonForRole,
} from './ticket-offer-role';

function isPurchasableOffer(offer: TicketOfferEvidence): boolean {
  return offer.availability === 'available' || offer.availability === 'free';
}

function offerClassification(offer: TicketOfferEvidence) {
  return classifyTicketOffer({
    label: offer.normalizedLabel ?? offer.rawLabel ?? '',
    category: offer.category,
    description: offer.description,
  });
}

function isSelectableRegularAdmissionOffer(offer: TicketOfferEvidence): boolean {
  const classified = offerClassification(offer);
  if (isSelectableRegularAdmission(classified)) {
    return true;
  }
  if (!offer.role || !isAdmissionOfferRole(offer.role)) {
    return false;
  }
  const label = (offer.normalizedLabel ?? offer.rawLabel ?? '').trim();
  if (isGenericPlaceholderOfferLabel(label)) {
    return false;
  }
  return isSelectableRegularAdmission({
    role: normalizeOfferRole(offer.role),
    grantsEventEntry: isAdmissionOfferRole(offer.role),
    requiresBaseTicket: false,
  });
}

export interface RegularAdmissionSelection {
  selected?: TicketOfferEvidence;
  rejectedCheaperOffers: Array<{
    offer: TicketOfferEvidence;
    reason: string;
  }>;
}

export function selectRegularAdmissionOfferWithAudit(
  evidence: EventTicketEvidence,
): RegularAdmissionSelection {
  const regularOffers = evidence.offers.filter((offer) => isSelectableRegularAdmissionOffer(offer));
  const purchasable = regularOffers.filter(
    (offer) => offer.amountMinor !== undefined && isPurchasableOffer(offer),
  );
  const selected =
    purchasable.length === 0
      ? undefined
      : purchasable.sort(
          (left, right) => (left.amountMinor ?? Number.MAX_SAFE_INTEGER) - (right.amountMinor ?? Number.MAX_SAFE_INTEGER),
        )[0];

  const rejectedCheaperOffers: RegularAdmissionSelection['rejectedCheaperOffers'] = [];
  for (const offer of evidence.offers) {
    if (selected && offer === selected) {
      continue;
    }
    if (offer.amountMinor === undefined) {
      continue;
    }
    if (selected && (offer.amountMinor ?? Number.MAX_SAFE_INTEGER) >= (selected.amountMinor ?? 0)) {
      continue;
    }
    let reason: string;
    if (!isPurchasableOffer(offer)) {
      reason = offer.availability === 'sold_out' ? 'sold_out' : 'not_available';
    } else if (!isSelectableRegularAdmissionOffer(offer)) {
      const classification = offerClassification(offer);
      reason = classification.rejectionReason ?? rejectionReasonForRole(classification.role);
    } else {
      reason = 'not_minimum_regular_admission';
    }
    rejectedCheaperOffers.push({ offer, reason });
  }

  return { selected, rejectedCheaperOffers };
}

export function selectRegularAdmissionOffer(evidence: EventTicketEvidence): TicketOfferEvidence | undefined {
  return selectRegularAdmissionOfferWithAudit(evidence).selected;
}

export function hasPurchasableRegularAdmission(evidence: EventTicketEvidence): boolean {
  return selectRegularAdmissionOffer(evidence) !== undefined;
}
