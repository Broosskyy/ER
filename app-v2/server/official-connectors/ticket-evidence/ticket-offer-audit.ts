import type { EventTicketEvidence, TicketOfferEvidence } from './types';
import {
  classifyTicketOffer,
  isSelectableRegularAdmission,
  normalizeOfferRole,
  rejectionReasonForRole,
} from './ticket-offer-role';

export interface RawProviderOffer {
  productName: string;
  category?: string;
  description?: string;
  priceMinor?: number;
  rawPrice?: string;
  availability: string;
}

export interface OfferRoleDecisionRow {
  eventTitle: string;
  provider: string;
  productName: string;
  category?: string;
  priceMinor?: number;
  availability: string;
  role: string;
  grantsEventEntry: boolean;
  requiresBaseTicket: boolean;
  accepted: boolean;
  reason: string;
}

export interface IndependentPriceAuditResult {
  eventTitle: string;
  provider: string;
  selectedRegularAdmissionOffer?: string;
  selectedPriceMinor?: number;
  rejectedCheaperOffers: Array<{ productName: string; priceMinor?: number; reason: string }>;
  counters: Record<string, number>;
  passed: boolean;
  failures: string[];
}

function availabilityFromText(value: string): 'available' | 'sold_out' | 'other' {
  if (/sold[\s_-]*out|ausverkauft/i.test(value)) {
    return 'sold_out';
  }
  if (/available|instock|verfügbar/i.test(value) || value.trim() === '') {
    return 'available';
  }
  return 'other';
}

function auditCounterKeyForRole(role: string): string | undefined {
  switch (normalizeOfferRole(role)) {
    case 'parking':
      return 'parkingSelectedAsAdmission';
    case 'shuttle':
      return 'shuttleSelectedAsAdmission';
    case 'locker':
      return 'lockerSelectedAsAdmission';
    case 'upgrade':
      return 'upgradeSelectedAsAdmission';
    case 'camping':
      return 'campingOnlySelectedAsAdmission';
    case 'merchandise':
      return 'merchandiseSelectedAsAdmission';
    case 'unknown':
      return 'unknownOfferSelectedAsAdmission';
    case 'other_addon':
    case 'food_or_beverage':
    case 'power_or_equipment':
    case 'insurance':
    case 'donation':
      return 'addonSelectedAsAdmission';
    default:
      return undefined;
  }
}

export function auditRawProviderOffers(input: {
  eventTitle: string;
  provider: string;
  offers: RawProviderOffer[];
}): { rows: OfferRoleDecisionRow[]; selected?: RawProviderOffer; rejectedCheaperOffers: Array<{ productName: string; priceMinor?: number; reason: string }> } {
  const rows: OfferRoleDecisionRow[] = [];
  let selected: RawProviderOffer | undefined;
  const rejectedCheaperOffers: Array<{ productName: string; priceMinor?: number; reason: string }> = [];

  for (const offer of input.offers) {
    const classification = classifyTicketOffer({
      label: offer.productName,
      category: offer.category,
      description: offer.description,
    });
    const availability = availabilityFromText(offer.availability);
    const accepted =
      isSelectableRegularAdmission(classification) &&
      availability === 'available' &&
      offer.priceMinor !== undefined;
    rows.push({
      eventTitle: input.eventTitle,
      provider: input.provider,
      productName: offer.productName,
      category: offer.category,
      priceMinor: offer.priceMinor,
      availability: offer.availability,
      role: classification.role,
      grantsEventEntry: classification.grantsEventEntry,
      requiresBaseTicket: classification.requiresBaseTicket,
      accepted,
      reason: accepted
        ? 'regular_admission'
        : availability === 'sold_out'
          ? 'sold_out'
          : classification.rejectionReason ?? rejectionReasonForRole(classification.role),
    });
    if (accepted) {
      if (!selected || (offer.priceMinor ?? Number.MAX_SAFE_INTEGER) < (selected.priceMinor ?? Number.MAX_SAFE_INTEGER)) {
        selected = offer;
      }
    }
  }

  for (const offer of input.offers) {
    if (selected && offer === selected) {
      continue;
    }
    if (offer.priceMinor === undefined) {
      continue;
    }
    if (selected && selected.priceMinor !== undefined && offer.priceMinor >= selected.priceMinor) {
      continue;
    }
    const classification = classifyTicketOffer({
      label: offer.productName,
      category: offer.category,
      description: offer.description,
    });
    const availability = availabilityFromText(offer.availability);
    let reason: string;
    if (availability === 'sold_out') {
      reason = 'sold_out';
    } else if (!isSelectableRegularAdmission(classification)) {
      reason = classification.rejectionReason ?? rejectionReasonForRole(classification.role);
    } else {
      reason = 'not_minimum_regular_admission';
    }
    rejectedCheaperOffers.push({
      productName: offer.productName,
      priceMinor: offer.priceMinor,
      reason,
    });
  }

  return { rows, selected, rejectedCheaperOffers };
}

export function auditSelectedPriceAgainstEvidence(input: {
  eventTitle: string;
  provider: string;
  selectedPriceMinor?: number;
  selectedOffer?: TicketOfferEvidence;
  evidence: EventTicketEvidence;
}): IndependentPriceAuditResult {
  const counters = {
    addonSelectedAsAdmission: 0,
    parkingSelectedAsAdmission: 0,
    shuttleSelectedAsAdmission: 0,
    lockerSelectedAsAdmission: 0,
    upgradeSelectedAsAdmission: 0,
    campingOnlySelectedAsAdmission: 0,
    merchandiseSelectedAsAdmission: 0,
    soldOutTierSelectedAsCurrentMinimum: 0,
    unknownOfferSelectedAsAdmission: 0,
    selectedPriceWithoutAdmissionEvidence: 0,
  };
  const failures: string[] = [];

  const selected = input.selectedOffer;
  if (!selected || input.selectedPriceMinor === undefined) {
    if (input.selectedPriceMinor !== undefined && input.evidence.offers.length > 0) {
      counters.selectedPriceWithoutAdmissionEvidence = 1;
      failures.push('selected_price_without_offer_object');
    }
    return {
      eventTitle: input.eventTitle,
      provider: input.provider,
      rejectedCheaperOffers: [],
      counters,
      passed: failures.length === 0,
      failures,
    };
  }

  const classification = classifyTicketOffer({
    label: selected.normalizedLabel ?? selected.rawLabel ?? '',
    category: selected.category,
    description: selected.description,
  });

  if (!isSelectableRegularAdmission(classification)) {
    const counterKey = auditCounterKeyForRole(classification.role);
    if (counterKey) {
      counters[counterKey as keyof typeof counters] = 1;
    } else {
      counters.selectedPriceWithoutAdmissionEvidence = 1;
    }
    failures.push(`selected_offer_not_regular_admission:${classification.role}`);
  }

  if (selected.availability === 'sold_out') {
    counters.soldOutTierSelectedAsCurrentMinimum = 1;
    failures.push('sold_out_selected_as_minimum');
  }

  const rawOffers: RawProviderOffer[] = input.evidence.offers.map((offer) => ({
    productName: offer.normalizedLabel ?? offer.rawLabel ?? '',
    category: offer.category,
    description: offer.description,
    priceMinor: offer.amountMinor,
    rawPrice: offer.rawPrice,
    availability: offer.availability,
  }));

  const independent = auditRawProviderOffers({
    eventTitle: input.eventTitle,
    provider: input.provider,
    offers: rawOffers,
  });

  if (independent.selected?.priceMinor !== input.selectedPriceMinor) {
    failures.push(
      `independent_selection_mismatch:${independent.selected?.priceMinor ?? 'none'}!=${input.selectedPriceMinor}`,
    );
  }

  return {
    eventTitle: input.eventTitle,
    provider: input.provider,
    selectedRegularAdmissionOffer: selected.normalizedLabel ?? selected.rawLabel,
    selectedPriceMinor: input.selectedPriceMinor,
    rejectedCheaperOffers: independent.rejectedCheaperOffers,
    counters,
    passed: failures.length === 0,
    failures,
  };
}

export function mergeAuditCounters(
  results: IndependentPriceAuditResult[],
): Record<string, number> {
  const merged: Record<string, number> = {
    addonSelectedAsAdmission: 0,
    parkingSelectedAsAdmission: 0,
    shuttleSelectedAsAdmission: 0,
    lockerSelectedAsAdmission: 0,
    upgradeSelectedAsAdmission: 0,
    campingOnlySelectedAsAdmission: 0,
    merchandiseSelectedAsAdmission: 0,
    soldOutTierSelectedAsCurrentMinimum: 0,
    unknownOfferSelectedAsAdmission: 0,
    selectedPriceWithoutAdmissionEvidence: 0,
  };
  for (const result of results) {
    for (const [key, value] of Object.entries(result.counters)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
}
