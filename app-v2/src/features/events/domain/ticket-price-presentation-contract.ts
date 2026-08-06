import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';

export type TicketPriceMissingCause =
  | 'PUBLIC_PRICE_NOT_AVAILABLE'
  | 'CHECKOUT_NOT_LINKED'
  | 'ADMISSION_PRODUCT_NOT_FOUND'
  | 'ADDON_FILTERING_ERROR'
  | 'PRICE_EXTRACTION_FAILED'
  | 'VALID_EVIDENCE_NOT_PERSISTED'
  | 'PROJECTION_MISSING'
  | 'REVIEW_REQUIRED';

export type TicketPriceReviewState = 'verified' | 'missing' | 'review_required' | 'sold_out';

export interface NormalizedTicketPriceModel {
  displayPriceText?: string;
  minimumPrice?: number;
  maximumPrice?: number;
  currency?: string;
  availability: 'available' | 'sold_out' | 'unknown' | 'external_link';
  soldOut: boolean;
  ticketPhases?: CanonicalTicketPhase[];
  admissionProducts?: Array<{
    name: string;
    phaseName?: string;
    priceAmount?: number;
    priceText?: string;
    soldOut?: boolean;
    isAdmission: boolean;
  }>;
  checkoutUrl?: string;
  consumerCtaUrl?: string;
  provider?: string;
  evidence: {
    source: string;
    surface?: string;
    freshnessAt?: string;
    confidence?: number;
    reviewState: TicketPriceReviewState;
    missingCause?: TicketPriceMissingCause;
  };
}

export interface ConsumerPricePresentationSlots {
  headerPrice?: string;
  sectionStandalonePrice?: string;
  phasePrices: string[];
  subtotal?: string;
  total?: string;
  availabilityLabel?: string;
  ctaLabel?: string;
}

export interface ConsumerPricePresentationAudit {
  eventId: string;
  title: string;
  slots: ConsumerPricePresentationSlots;
  duplicateGroups: Array<{ value: string; surfaces: string[] }>;
  redundantSubtotalTotal: boolean;
  proposedSlots: ConsumerPricePresentationSlots;
}

export const TICKET_PRICE_CONTRACT_RULES = {
  evidence: [
    'explicit Event-specific evidence only',
    'admission products only — add-ons excluded',
    'sold-out is not zero price',
    'checkout provider and consumer CTA remain independent',
    'empty evidence cannot clear valid price',
    'stale evidence cannot outrank fresh evidence',
    'platform-specific raw objects must not reach consumer layer',
  ],
  header: [
    'at most one compact summary: ab X € | exact X € | no price | sold-out badge',
  ],
  ticketSection: [
    'provider + availability + meaningful phase cards',
    'one price per distinct admission phase',
    'no duplicate standalone price when phase cards carry same amount',
    'no subtotal/total without cart selection',
    'no repeated identical price blocks',
  ],
  singlePhase: [
    'one phase card only',
    'do not repeat same amount in subtotal and total',
  ],
  noPrice: [
    'provider/CTA without fabricated price',
  ],
} as const;

function normalizeComparablePrice(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function detectDuplicatePriceSurfaces(
  slots: ConsumerPricePresentationSlots,
): Array<{ value: string; surfaces: string[] }> {
  const entries: Array<{ surface: string; value: string }> = [];
  if (slots.headerPrice) entries.push({ surface: 'header', value: slots.headerPrice });
  if (slots.sectionStandalonePrice) {
    entries.push({ surface: 'section_standalone', value: slots.sectionStandalonePrice });
  }
  slots.phasePrices.forEach((price, index) => {
    entries.push({ surface: `phase_${index}`, value: price });
  });
  if (slots.subtotal) entries.push({ surface: 'subtotal', value: slots.subtotal });
  if (slots.total) entries.push({ surface: 'total', value: slots.total });

  const byValue = new Map<string, string[]>();
  for (const entry of entries) {
    const key = normalizeComparablePrice(entry.value) ?? '';
    if (!key) continue;
    const list = byValue.get(key) ?? [];
    list.push(entry.surface);
    byValue.set(key, list);
  }

  return [...byValue.entries()]
    .filter(([, surfaces]) => surfaces.length > 1)
    .map(([value, surfaces]) => ({ value, surfaces }));
}

export function proposeConsumerPricePresentation(
  slots: ConsumerPricePresentationSlots,
): ConsumerPricePresentationSlots {
  const phaseCount = slots.phasePrices.length;
  const hasPhases = phaseCount > 0;
  const duplicates = detectDuplicatePriceSurfaces(slots);

  const proposed: ConsumerPricePresentationSlots = {
    headerPrice: slots.headerPrice,
    availabilityLabel: slots.availabilityLabel,
    ctaLabel: slots.ctaLabel,
    phasePrices: [...slots.phasePrices],
    sectionStandalonePrice: slots.sectionStandalonePrice,
    subtotal: slots.subtotal,
    total: slots.total,
  };

  if (hasPhases) {
    proposed.sectionStandalonePrice = undefined;
    proposed.subtotal = undefined;
    proposed.total = undefined;
  } else if (slots.headerPrice && slots.sectionStandalonePrice) {
    proposed.sectionStandalonePrice = undefined;
  }

  if (phaseCount === 1 && slots.subtotal && slots.total) {
    proposed.subtotal = undefined;
    proposed.total = undefined;
  }

  if (duplicates.length > 0 && hasPhases) {
    proposed.subtotal = undefined;
    proposed.total = undefined;
  }

  return proposed;
}

export function auditConsumerPricePresentation(input: {
  eventId: string;
  title: string;
  slots: ConsumerPricePresentationSlots;
}): ConsumerPricePresentationAudit {
  const duplicateGroups = detectDuplicatePriceSurfaces(input.slots);
  const proposedSlots = proposeConsumerPricePresentation(input.slots);
  return {
    eventId: input.eventId,
    title: input.title,
    slots: input.slots,
    duplicateGroups,
    redundantSubtotalTotal:
      Boolean(input.slots.subtotal && input.slots.total) &&
      normalizeComparablePrice(input.slots.subtotal) ===
        normalizeComparablePrice(input.slots.total),
    proposedSlots,
  };
}
