import { formatDisplayPriceText, parseGermanPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';

export const PRICE_STATES = ['paid', 'free', 'unknown', 'unavailable'] as const;
export type PriceState = (typeof PRICE_STATES)[number];

export const AVAILABILITY_STATES = [
  'available',
  'limited',
  'sold_out',
  'unavailable',
  'unknown',
] as const;
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export type SemanticColorToken = 'accent' | 'success' | 'unavailable' | 'muted';

export interface TicketPhaseAvailability {
  soldOut?: boolean;
  available?: boolean;
  label?: string;
}

export interface EventPriceAvailabilitySemantics {
  priceState: PriceState;
  availabilityState: AvailabilityState;
  displayPriceText?: string;
  showPrice: boolean;
  showAvailabilityBadge: boolean;
  colorToken: SemanticColorToken;
  explanatoryLabel?: string;
}

const FREE_PRICE_PATTERN =
  /\b(free|kostenlos|gratis|eintritt\s*frei|no\s*ticket\s*required|kein\s*eintritt)\b/i;
const SOLD_OUT_PATTERN = /\b(ausverkauft|sold\s*out|vergriffen)\b/i;
const LIMITED_PATTERN = /\b(limited|wenige|fast\s*ausverkauft|nur\s*noch\s*wenige)\b/i;
const ABENDKASSE_PATTERN = /\b(abendkasse|box\s*office|an\s*der\s*abendkasse)\b/i;
const PRICE_ON_REQUEST_PATTERN = /\b(preis\s*auf\s*anfrage|price\s*on\s*request|tba)\b/i;
const UNAVAILABLE_PATTERN = /\b(nicht\s*verfügbar|not\s*available|sales\s*ended|verkauf\s*beendet)\b/i;

function normalizePriceText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function hasExplicitFreeSemantics(priceText: string): boolean {
  if (!priceText) {
    return false;
  }
  return FREE_PRICE_PATTERN.test(priceText);
}

function isAbendkasseNote(priceText: string): boolean {
  return ABENDKASSE_PATTERN.test(priceText) && !/\d/.test(priceText);
}

function resolvePhaseAvailability(phases: TicketPhaseAvailability[] | undefined): AvailabilityState | undefined {
  if (!phases?.length) {
    return undefined;
  }

  const known = phases.filter((phase) => phase.soldOut !== undefined || phase.available !== undefined);
  if (known.length === 0) {
    return undefined;
  }

  const anyAvailable = known.some((phase) => phase.available === true || phase.soldOut === false);
  const allSoldOut = known.every((phase) => phase.soldOut === true || phase.available === false);

  if (anyAvailable && !allSoldOut) {
    const anyLimited = known.some(
      (phase) => phase.soldOut === false && phase.available === true && LIMITED_PATTERN.test(phase.label ?? ''),
    );
    return anyLimited ? 'limited' : 'available';
  }

  if (allSoldOut) {
    return 'sold_out';
  }

  return 'unknown';
}

function resolveAvailabilityFromText(priceText: string): AvailabilityState | undefined {
  if (!priceText) {
    return undefined;
  }
  if (SOLD_OUT_PATTERN.test(priceText)) {
    return 'sold_out';
  }
  if (UNAVAILABLE_PATTERN.test(priceText)) {
    return 'unavailable';
  }
  if (LIMITED_PATTERN.test(priceText)) {
    return 'limited';
  }
  return undefined;
}

function resolvePriceState(priceText: string): PriceState {
  if (!priceText) {
    return 'unknown';
  }

  if (SOLD_OUT_PATTERN.test(priceText) || UNAVAILABLE_PATTERN.test(priceText)) {
    return 'unavailable';
  }

  if (hasExplicitFreeSemantics(priceText)) {
    return 'free';
  }

  if (isAbendkasseNote(priceText) || PRICE_ON_REQUEST_PATTERN.test(priceText)) {
    return 'unknown';
  }

  const parsed = parseGermanPriceText(priceText);
  if (parsed.amount !== undefined) {
    if (parsed.amount === 0) {
      return hasExplicitFreeSemantics(priceText) ? 'free' : 'unknown';
    }
    return 'paid';
  }

  const overviewAmount = priceText.match(/([\d]+[.,]\d{2}|\d+)\s*(?:euro|€|eur)/i);
  if (overviewAmount?.[1]) {
    const amount = Number.parseFloat(overviewAmount[1].replace(',', '.'));
    if (Number.isFinite(amount)) {
      if (amount === 0) {
        return hasExplicitFreeSemantics(priceText) ? 'free' : 'unknown';
      }
      return 'paid';
    }
  }

  return 'unknown';
}

function resolveColorToken(
  priceState: PriceState,
  availabilityState: AvailabilityState,
): SemanticColorToken {
  if (availabilityState === 'sold_out' || availabilityState === 'unavailable') {
    return 'unavailable';
  }
  if (availabilityState === 'available' || availabilityState === 'limited') {
    return availabilityState === 'limited' ? 'accent' : 'success';
  }
  if (priceState === 'free') {
    return 'success';
  }
  if (priceState === 'paid') {
    return 'accent';
  }
  return 'muted';
}

function resolveExplanatoryLabel(
  priceText: string,
  priceState: PriceState,
  availabilityState: AvailabilityState,
): string | undefined {
  if (availabilityState === 'sold_out') {
    return 'Ausverkauft';
  }
  if (availabilityState === 'unavailable') {
    return 'Tickets nicht verfügbar';
  }
  if (availabilityState === 'limited') {
    return 'Begrenzte Verfügbarkeit';
  }
  if (priceState === 'free') {
    return 'Kostenlos';
  }
  if (isAbendkasseNote(priceText)) {
    return 'Abendkasse';
  }
  if (PRICE_ON_REQUEST_PATTERN.test(priceText)) {
    return 'Preis auf Anfrage';
  }
  if (priceState === 'unknown' && !priceText) {
    return undefined;
  }
  return undefined;
}

/** Shared price + ticket availability semantics for all consumer surfaces. */
export function resolveEventPriceAvailabilitySemantics(input: {
  priceText?: string;
  lifecycleStatus?: string;
  ticketAvailability?: 'not_configured' | 'external_link' | 'on_sale' | 'sold_out' | 'sales_ended';
  ticketPhases?: TicketPhaseAvailability[];
}): EventPriceAvailabilitySemantics {
  const rawPriceText = normalizePriceText(input.priceText);
  const formattedPrice = formatDisplayPriceText(rawPriceText) ?? (rawPriceText || undefined);

  let availabilityState =
    resolvePhaseAvailability(input.ticketPhases) ??
    resolveAvailabilityFromText(rawPriceText) ??
    'unknown';

  if (input.lifecycleStatus === 'sold_out') {
    availabilityState = 'sold_out';
  } else if (input.ticketAvailability === 'sold_out') {
    availabilityState = 'sold_out';
  } else if (input.ticketAvailability === 'sales_ended') {
    availabilityState = 'unavailable';
  } else if (
    availabilityState === 'unknown' &&
    (input.ticketAvailability === 'on_sale' || input.ticketAvailability === 'external_link')
  ) {
    availabilityState = 'available';
  }

  const priceState = resolvePriceState(rawPriceText);
  const showAvailabilityBadge =
    availabilityState === 'sold_out' ||
    availabilityState === 'unavailable' ||
    availabilityState === 'limited';
  const showPrice =
    Boolean(formattedPrice) &&
    (priceState === 'paid' || priceState === 'free') &&
    availabilityState !== 'sold_out' &&
    availabilityState !== 'unavailable';

  const displayPriceText =
    availabilityState === 'sold_out' || priceState === 'unavailable'
      ? formattedPrice ?? resolveExplanatoryLabel(rawPriceText, priceState, availabilityState)
      : showPrice
        ? formattedPrice
        : isAbendkasseNote(rawPriceText) || PRICE_ON_REQUEST_PATTERN.test(rawPriceText)
          ? formattedPrice
          : undefined;

  return {
    priceState,
    availabilityState,
    displayPriceText,
    showPrice,
    showAvailabilityBadge,
    colorToken: resolveColorToken(priceState, availabilityState),
    explanatoryLabel: resolveExplanatoryLabel(rawPriceText, priceState, availabilityState),
  };
}

/** Discovery/map filter helper — missing price is not treated as free. */
export function isSemanticallyFreeEvent(input: {
  priceText?: string;
  lifecycleStatus?: string;
  ticketAvailability?: 'not_configured' | 'external_link' | 'on_sale' | 'sold_out' | 'sales_ended';
}): boolean {
  return resolveEventPriceAvailabilitySemantics(input).priceState === 'free';
}

/** Maps shared semantics to discovery ticket badge status. */
export function toDiscoveryTicketStatus(
  semantics: EventPriceAvailabilitySemantics,
): import('@/components/discovery/view-models').EventTicketStatus | undefined {
  if (semantics.availabilityState === 'sold_out') {
    return 'sold_out';
  }
  if (semantics.availabilityState === 'unavailable') {
    return 'unavailable';
  }
  if (semantics.availabilityState === 'limited') {
    return 'limited';
  }
  if (semantics.priceState === 'free') {
    return 'free';
  }
  if (semantics.priceState === 'paid' && semantics.showPrice) {
    return 'available';
  }
  if (semantics.priceState === 'paid' && semantics.displayPriceText) {
    return 'on_sale';
  }
  return undefined;
}
