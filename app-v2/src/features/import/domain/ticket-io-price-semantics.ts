import { formatGermanTicketPrice, parseGermanPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';

export type TicketPriceKind =
  | 'current_purchaseable'
  | 'historical_phase'
  | 'sold_out_status'
  | 'unavailable'
  | 'placeholder_zero';

export interface TicketIoPriceSemanticsInput {
  rawLabel?: string;
  soldOut?: boolean;
  amount?: number;
  currency?: string;
}

export interface TicketIoPriceSemantics {
  kind: TicketPriceKind;
  soldOut: boolean;
  currentPurchaseablePrice?: string;
  currentPurchaseableAmount?: number;
  historicalPhasePrice?: string;
  historicalPhaseAmount?: number;
  displayPriceLabel?: string;
  soldOutLabel: string;
  placeholderZeroRejected: boolean;
  rawLabel?: string;
}

export function isPlaceholderZeroPrice(label?: string): boolean {
  if (!label?.trim()) return false;
  const normalized = label.trim().toLowerCase();
  if (/ausverkauft|sold\s*out|vergriffen/i.test(normalized)) return false;
  const parsed = parseGermanPriceText(label);
  return parsed.amount === 0;
}

export function buildTicketIoPriceSemantics(input: TicketIoPriceSemanticsInput): TicketIoPriceSemantics {
  const rawLabel = input.rawLabel?.trim();
  const parsed = parseGermanPriceText(rawLabel);
  const soldOut = Boolean(input.soldOut || parsed.soldOut);
  const amount = input.amount ?? parsed.amount;
  const placeholderZeroRejected = isPlaceholderZeroPrice(rawLabel);

  if (placeholderZeroRejected) {
    return {
      kind: 'placeholder_zero',
      soldOut: false,
      soldOutLabel: 'Ausverkauft',
      placeholderZeroRejected: true,
      rawLabel,
    };
  }

  if (soldOut) {
    return {
      kind: 'sold_out_status',
      soldOut: true,
      soldOutLabel: 'Ausverkauft',
      displayPriceLabel: 'Ausverkauft',
      historicalPhasePrice: amount !== undefined ? formatGermanTicketPrice(amount, input.currency ?? 'EUR') : undefined,
      historicalPhaseAmount: amount,
      placeholderZeroRejected: false,
      rawLabel,
    };
  }

  if (amount !== undefined && Number.isFinite(amount) && amount > 0) {
    const label = formatGermanTicketPrice(amount, input.currency ?? 'EUR', { prefix: /\bab\b/i.test(rawLabel ?? '') ? 'ab' : 'ab' });
    return {
      kind: 'current_purchaseable',
      soldOut: false,
      currentPurchaseablePrice: label,
      currentPurchaseableAmount: amount,
      displayPriceLabel: label,
      soldOutLabel: 'Ausverkauft',
      placeholderZeroRejected: false,
      rawLabel,
    };
  }

  if (rawLabel && !soldOut) {
    return {
      kind: 'unavailable',
      soldOut: false,
      displayPriceLabel: rawLabel,
      soldOutLabel: 'Ausverkauft',
      placeholderZeroRejected: false,
      rawLabel,
    };
  }

  return {
    kind: 'unavailable',
    soldOut: false,
    soldOutLabel: 'Ausverkauft',
    placeholderZeroRejected: false,
    rawLabel,
  };
}

export type TicketIoPriceComparisonVerdict =
  | 'aligned'
  | 'production_stale'
  | 'live_price_drift'
  | 'sold_out_unified_correct'
  | 'placeholder_zero_conflict'
  | 'unified_incorrect';

export function compareTicketIoPriceSemantics(
  semantics: TicketIoPriceSemantics,
  productionPrice?: string,
): TicketIoPriceComparisonVerdict {
  const production = productionPrice?.trim();
  if (!production) return semantics.displayPriceLabel ? 'aligned' : 'aligned';

  if (semantics.kind === 'placeholder_zero' && isPlaceholderZeroPrice(production)) {
    return 'placeholder_zero_conflict';
  }

  if (semantics.soldOut) {
    const prodParsed = parseGermanPriceText(production);
    if (prodParsed.soldOut) return 'aligned';
    if (prodParsed.amount !== undefined && prodParsed.amount > 0) {
      return 'sold_out_unified_correct';
    }
    return 'aligned';
  }

  if (!semantics.currentPurchaseableAmount) {
    return production ? 'production_stale' : 'aligned';
  }

  const prodParsed = parseGermanPriceText(production);
  if (prodParsed.soldOut) return 'live_price_drift';

  if (prodParsed.amount !== undefined && Math.abs(prodParsed.amount - semantics.currentPurchaseableAmount) < 0.01) {
    return 'aligned';
  }

  if (prodParsed.amount !== undefined) {
    return 'production_stale';
  }

  return semantics.displayPriceLabel?.toLowerCase() === production.toLowerCase() ? 'aligned' : 'production_stale';
}
