export type TicketKingsProductClassification =
  | 'admission_ticket'
  | 'ticket_add_on'
  | 'fee'
  | 'insurance_or_flex'
  | 'donation'
  | 'parking_or_locker'
  | 'merchandise'
  | 'unknown_review_required';

export type TicketKingsStructuralRole =
  | 'admission_option'
  | 'addon_checkbox'
  | 'buyer_optional'
  | 'legacy_card'
  | 'unknown';

export interface TicketKingsProductClassificationInput {
  structuralRole: TicketKingsStructuralRole;
  sectionHeading?: string;
  productName: string;
  structuralClassName?: string;
  isCheckbox?: boolean;
  isQuantityStepper?: boolean;
}

export interface TicketKingsProductClassificationResult {
  classification: TicketKingsProductClassification;
  includedInEventSummary: boolean;
  exclusionReason?: string;
  structuralSignals: string[];
}

const INSURANCE_FLEX_PATTERN =
  /\b(flex|versicherung|insurance|storno|cancellation|umbuch|rebooking)\b/i;
const PARKING_LOCKER_PATTERN =
  /\b(parking|parkplatz|garderobe|locker|schließfach|cloak\s*room)\b/i;
const DONATION_PATTERN = /\b(spende|donation|tip|trinkgeld)\b/i;
const MERCHANDISE_PATTERN = /\b(merch(andise)?|t-?shirt|hoodie|poster|cap)\b/i;
const FEE_PATTERN = /\b(gebühr|fee|service\s*charge|bearbeitungsgebühr)\b/i;
const UPGRADE_ADDON_PATTERN = /\b(upgrade|zusatz|add-?on|addon|option)\b/i;

function normalizeProductName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function classifyTicketKingsProduct(
  input: TicketKingsProductClassificationInput,
): TicketKingsProductClassificationResult {
  const productName = normalizeProductName(input.productName);
  const sectionHeading = input.sectionHeading?.trim();
  const signals: string[] = [input.structuralRole];

  if (sectionHeading) {
    signals.push(`section:${sectionHeading}`);
  }
  if (input.isCheckbox) {
    signals.push('checkbox_optional');
  }
  if (input.isQuantityStepper) {
    signals.push('quantity_stepper');
  }

  if (input.structuralRole === 'admission_option') {
    return {
      classification: 'admission_ticket',
      includedInEventSummary: true,
      structuralSignals: signals,
    };
  }

  if (input.structuralRole === 'addon_checkbox') {
    if (INSURANCE_FLEX_PATTERN.test(productName)) {
      return {
        classification: 'insurance_or_flex',
        includedInEventSummary: false,
        exclusionReason: 'optional_insurance_or_flex_add_on',
        structuralSignals: signals,
      };
    }
    if (PARKING_LOCKER_PATTERN.test(productName)) {
      return {
        classification: 'parking_or_locker',
        includedInEventSummary: false,
        exclusionReason: 'supplementary_parking_or_locker_product',
        structuralSignals: signals,
      };
    }
    if (MERCHANDISE_PATTERN.test(productName)) {
      return {
        classification: 'merchandise',
        includedInEventSummary: false,
        exclusionReason: 'merchandise_add_on',
        structuralSignals: signals,
      };
    }
    if (FEE_PATTERN.test(productName)) {
      return {
        classification: 'fee',
        includedInEventSummary: false,
        exclusionReason: 'fee_add_on',
        structuralSignals: signals,
      };
    }
    return {
      classification: 'ticket_add_on',
      includedInEventSummary: false,
      exclusionReason: 'optional_checkout_add_on',
      structuralSignals: signals,
    };
  }

  if (input.structuralRole === 'buyer_optional') {
    if (DONATION_PATTERN.test(productName)) {
      return {
        classification: 'donation',
        includedInEventSummary: false,
        exclusionReason: 'optional_buyer_donation',
        structuralSignals: signals,
      };
    }
    return {
      classification: 'unknown_review_required',
      includedInEventSummary: false,
      exclusionReason: 'optional_buyer_section_product_requires_review',
      structuralSignals: signals,
    };
  }

  if (
    input.structuralRole === 'legacy_card' &&
    input.structuralClassName &&
    /ticket-release|ticket-option-choice|ticket-option-main/i.test(input.structuralClassName)
  ) {
    if (
      !INSURANCE_FLEX_PATTERN.test(productName) &&
      !PARKING_LOCKER_PATTERN.test(productName) &&
      !DONATION_PATTERN.test(productName)
    ) {
      return {
        classification: 'admission_ticket',
        includedInEventSummary: true,
        structuralSignals: [...signals, 'legacy_admission_card'],
      };
    }
  }

  if (INSURANCE_FLEX_PATTERN.test(productName)) {
    return {
      classification: 'insurance_or_flex',
      includedInEventSummary: false,
      exclusionReason: 'name_matches_insurance_or_flex',
      structuralSignals: signals,
    };
  }
  if (PARKING_LOCKER_PATTERN.test(productName)) {
    return {
      classification: 'parking_or_locker',
      includedInEventSummary: false,
      exclusionReason: 'name_matches_parking_or_locker',
      structuralSignals: signals,
    };
  }
  if (DONATION_PATTERN.test(productName)) {
    return {
      classification: 'donation',
      includedInEventSummary: false,
      exclusionReason: 'name_matches_donation',
      structuralSignals: signals,
    };
  }
  if (MERCHANDISE_PATTERN.test(productName)) {
    return {
      classification: 'merchandise',
      includedInEventSummary: false,
      exclusionReason: 'name_matches_merchandise',
      structuralSignals: signals,
    };
  }
  if (FEE_PATTERN.test(productName)) {
    return {
      classification: 'fee',
      includedInEventSummary: false,
      exclusionReason: 'name_matches_fee',
      structuralSignals: signals,
    };
  }
  if (UPGRADE_ADDON_PATTERN.test(productName) && !input.isQuantityStepper) {
    return {
      classification: 'ticket_add_on',
      includedInEventSummary: false,
      exclusionReason: 'name_matches_add_on_without_admission_structure',
      structuralSignals: signals,
    };
  }

  return {
    classification: 'unknown_review_required',
    includedInEventSummary: false,
    exclusionReason: 'unclassified_legacy_or_ambiguous_product',
    structuralSignals: signals,
  };
}

export function aggregateAdmissionAvailability(
  products: Array<{ classification: TicketKingsProductClassification; soldOut?: boolean; available?: boolean }>,
): 'available' | 'sold_out' | 'review_required' {
  const admissions = products.filter((product) => product.classification === 'admission_ticket');
  if (admissions.length === 0) {
    return 'review_required';
  }

  const known = admissions.filter(
    (product) => product.soldOut !== undefined || product.available !== undefined,
  );
  if (known.length === 0) {
    return 'review_required';
  }

  const anyAvailable = known.some((product) => product.available === true || product.soldOut === false);
  if (anyAvailable) {
    return 'available';
  }

  const allSoldOut = known.every((product) => product.soldOut === true || product.available === false);
  if (allSoldOut) {
    return 'sold_out';
  }

  return 'review_required';
}
