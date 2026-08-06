import { formatGermanTicketPrice } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import type { TicketIoTicketOffer } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';
import type { TicketPhaseAvailability } from '@/features/events/domain/event-price-availability-semantics';

export type CanonicalTicketPhaseKind =
  | 'early_bird'
  | 'phase_1'
  | 'phase_2'
  | 'phase_3'
  | 'regular'
  | 'vip'
  | 'abendkasse'
  | 'guest_list'
  | 'registration'
  | 'other';

export interface CanonicalTicketPhase {
  id: string;
  name: string;
  sortOrder: number;
  kind: CanonicalTicketPhaseKind;
  priceAmount?: number;
  totalPriceAmount?: number;
  feeAmount?: number;
  priceCurrency?: string;
  priceLabel?: string;
  totalPriceLabel?: string;
  feeLabel?: string;
  note?: string;
  soldOut?: boolean;
  available?: boolean;
  isFree?: boolean;
  purchaseUrl?: string;
  validFrom?: string;
  validUntil?: string;
}

const PHASE_KIND_ORDER: CanonicalTicketPhaseKind[] = [
  'early_bird',
  'phase_1',
  'phase_2',
  'phase_3',
  'regular',
  'vip',
  'abendkasse',
  'guest_list',
  'registration',
  'other',
];

const FREE_PATTERN =
  /\b(free|kostenlos|gratis|eintritt\s*frei|no\s*ticket\s*required|kein\s*eintritt)\b/i;
const ABENDKASSE_PATTERN = /\b(abendkasse|box\s*office|an\s*der\s*abendkasse)\b/i;
const GUEST_LIST_PATTERN = /\b(guest\s*list|gästeliste|gäste\s*liste)\b/i;
const REGISTRATION_PATTERN = /\b(registrierung|registration|anmeldung)\b/i;
const VIP_PATTERN = /\b(vip)\b/i;
const EARLY_BIRD_PATTERN = /\b(early\s*bird|frühbucher)\b/i;

function normalizePhaseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolvePhaseKind(name: string): CanonicalTicketPhaseKind {
  const normalized = normalizePhaseName(name);
  if (EARLY_BIRD_PATTERN.test(normalized)) {
    return 'early_bird';
  }
  if (/^phase\s*1\b/.test(normalized)) {
    return 'phase_1';
  }
  if (/^phase\s*2\b/.test(normalized)) {
    return 'phase_2';
  }
  if (/^phase\s*3\b/.test(normalized)) {
    return 'phase_3';
  }
  if (ABENDKASSE_PATTERN.test(normalized)) {
    return 'abendkasse';
  }
  if (GUEST_LIST_PATTERN.test(normalized)) {
    return 'guest_list';
  }
  if (REGISTRATION_PATTERN.test(normalized)) {
    return 'registration';
  }
  if (VIP_PATTERN.test(normalized)) {
    return 'vip';
  }
  if (/^regular\b/.test(normalized) || normalized === 'standard') {
    return 'regular';
  }
  return 'other';
}

function resolvePhaseSortOrder(kind: CanonicalTicketPhaseKind, index: number): number {
  const base = PHASE_KIND_ORDER.indexOf(kind);
  return base >= 0 ? base * 100 + index : 900 + index;
}

function isSoldOutAvailability(availability: string | undefined, soldOut?: boolean): boolean {
  if (soldOut) {
    return true;
  }
  const token = availability?.split('/').pop()?.toLowerCase() ?? availability?.toLowerCase();
  return token === 'soldout' || token === 'outofstock';
}

function isExplicitFree(name: string, amount: number | undefined): boolean {
  if (amount === 0 && FREE_PATTERN.test(name)) {
    return true;
  }
  return FREE_PATTERN.test(name) && amount === undefined;
}

function buildPhaseId(name: string, purchaseUrl?: string): string {
  const slug = normalizePhaseName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const urlPart = purchaseUrl ? normalizePhaseName(purchaseUrl).slice(-12) : '';
  return `phase-${slug || 'ticket'}${urlPart ? `-${urlPart}` : ''}`;
}

function parseFeeFromNote(note: string | undefined): { feeAmount?: number; feeLabel?: string } {
  if (!note?.trim()) {
    return {};
  }
  const feeMatch = note.match(/(?:gebühr|fee)\s*[:+]?\s*([\d]+[.,]\d{2}|\d+)/i);
  if (!feeMatch?.[1]) {
    return { feeLabel: note.trim() };
  }
  const feeAmount = Number.parseFloat(feeMatch[1].replace(',', '.'));
  return {
    feeAmount: Number.isFinite(feeAmount) ? feeAmount : undefined,
    feeLabel: note.trim(),
  };
}

export function normalizeSourceTicketOffer(
  offer: TicketIoTicketOffer,
  index: number,
): CanonicalTicketPhase {
  const name = offer.name?.trim() || `Ticket ${index + 1}`;
  const kind = resolvePhaseKind(name);
  const soldOut = isSoldOutAvailability(offer.availability, offer.soldOut);
  const available = soldOut ? false : offer.soldOut === false ? true : undefined;
  const isFree = isExplicitFree(name, offer.priceAmount);
  const isAbendkasseNote = kind === 'abendkasse' && offer.priceAmount === undefined;

  let priceLabel: string | undefined;
  if (soldOut) {
    priceLabel = 'Ausverkauft';
  } else if (isFree) {
    priceLabel = 'Kostenlos';
  } else if (isAbendkasseNote) {
    priceLabel = name;
  } else if (offer.priceAmount !== undefined) {
    priceLabel = formatGermanTicketPrice(offer.priceAmount, offer.priceCurrency ?? 'EUR', {
      prefix: kind === 'regular' ? undefined : 'ab',
    });
  }

  const feeParts = parseFeeFromNote(undefined);

  return {
    id: buildPhaseId(name, offer.purchaseUrl),
    name,
    sortOrder: resolvePhaseSortOrder(kind, index),
    kind,
    priceAmount: offer.priceAmount,
    priceCurrency: offer.priceCurrency ?? 'EUR',
    priceLabel,
    soldOut,
    available,
    isFree,
    purchaseUrl: offer.purchaseUrl,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    note: isAbendkasseNote ? name : undefined,
    ...feeParts,
  };
}

export function extractTicketOffersFromCandidate(
  candidate: CanonicalImportEvent,
): TicketIoTicketOffer[] | undefined {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const raw = metadata?.ticketOffers;
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  return raw.filter((entry) => entry && typeof entry === 'object') as TicketIoTicketOffer[];
}

export function normalizeTicketOffersFromCandidate(
  candidate: CanonicalImportEvent,
): CanonicalTicketPhase[] | undefined {
  const offers = extractTicketOffersFromCandidate(candidate);
  if (!offers?.length) {
    return undefined;
  }
  const phases = offers.map((offer, index) => normalizeSourceTicketOffer(offer, index));
  return sortTicketPhases(dedupeTicketPhases(phases));
}

export function sortTicketPhases(phases: CanonicalTicketPhase[]): CanonicalTicketPhase[] {
  return [...phases].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.name.localeCompare(right.name, 'de');
  });
}

export function dedupeTicketPhases(phases: CanonicalTicketPhase[]): CanonicalTicketPhase[] {
  const seen = new Map<string, CanonicalTicketPhase>();
  for (const phase of phases) {
    const key = `${normalizePhaseName(phase.name)}|${phase.priceAmount ?? ''}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, phase);
      continue;
    }
    const existingScore = scoreTicketPhase(existing);
    const incomingScore = scoreTicketPhase(phase);
    if (incomingScore > existingScore) {
      seen.set(key, phase);
    }
  }
  return [...seen.values()];
}

function scoreTicketPhase(phase: CanonicalTicketPhase): number {
  let score = 0;
  if (phase.priceAmount !== undefined) score += 4;
  if (phase.priceLabel) score += 2;
  if (phase.purchaseUrl) score += 1;
  if (phase.validFrom || phase.validUntil) score += 1;
  if (phase.soldOut !== undefined) score += 1;
  return score;
}

export function mergeTicketPhases(
  existing: CanonicalTicketPhase[] | undefined,
  incoming: CanonicalTicketPhase[] | undefined,
  options: { fillOnly?: boolean } = {},
): CanonicalTicketPhase[] | undefined {
  if (!incoming?.length) {
    return existing;
  }
  if (!existing?.length) {
    return incoming;
  }
  void options.fillOnly;
  return sortTicketPhases(dedupeTicketPhases([...existing, ...incoming]));
}

export function isPhaseAvailableForPricing(phase: CanonicalTicketPhase): boolean {
  if (phase.soldOut || phase.available === false) {
    return false;
  }
  if (phase.isFree) {
    return true;
  }
  if (phase.kind === 'abendkasse' && phase.priceAmount === undefined) {
    return false;
  }
  return phase.priceAmount !== undefined;
}

export function deriveSummaryPriceTextFromPhases(phases: CanonicalTicketPhase[] | undefined): string | undefined {
  if (!phases?.length) {
    return undefined;
  }
  const priced = phases.filter(isPhaseAvailableForPricing);
  const freeOnly = priced.length > 0 && priced.every((phase) => phase.isFree);
  if (freeOnly) {
    return 'Kostenlos';
  }

  const amounts = priced
    .map((phase) => phase.priceAmount)
    .filter((amount): amount is number => amount !== undefined && Number.isFinite(amount));
  if (amounts.length === 0) {
    const allSoldOut = phases.every((phase) => phase.soldOut);
    if (allSoldOut) {
      return 'Ausverkauft';
    }
    const abendkasse = phases.find((phase) => phase.kind === 'abendkasse');
    if (abendkasse?.note) {
      return abendkasse.note;
    }
    return undefined;
  }

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const currency = priced.find((phase) => phase.priceCurrency)?.priceCurrency ?? 'EUR';
  if (min === max) {
    return formatGermanTicketPrice(min, currency);
  }
  return `${formatGermanTicketPrice(min, currency, { prefix: 'ab' })} – ${formatGermanTicketPrice(max, currency)}`;
}

export function deriveTicketStatusFromPhases(
  phases: CanonicalTicketPhase[] | undefined,
  fallback?: AdminEventTicketStatus,
): AdminEventTicketStatus | undefined {
  if (!phases?.length) {
    return fallback;
  }
  const known = phases.filter((phase) => phase.soldOut !== undefined || phase.available !== undefined);
  if (known.length === 0) {
    return fallback;
  }
  const anyAvailable = known.some((phase) => phase.available === true || phase.soldOut === false);
  const allSoldOut = known.every((phase) => phase.soldOut === true || phase.available === false);
  if (anyAvailable) {
    return 'on_sale';
  }
  if (allSoldOut) {
    return 'sold_out';
  }
  return fallback;
}

export type AdminEventTicketStatus =
  | 'not_configured'
  | 'external_link'
  | 'on_sale'
  | 'sold_out'
  | 'sales_ended';

export function toTicketPhaseAvailability(
  phases: CanonicalTicketPhase[] | undefined,
): TicketPhaseAvailability[] | undefined {
  if (!phases?.length) {
    return undefined;
  }
  return phases.map((phase) => ({
    soldOut: phase.soldOut,
    available: phase.available ?? (phase.soldOut === false ? true : undefined),
    label: phase.name,
  }));
}

export function hasMeaningfulTicketPhaseUpgrade(
  existing: CanonicalTicketPhase[] | undefined,
  incoming: CanonicalTicketPhase[] | undefined,
): boolean {
  if (!incoming?.length) {
    return false;
  }
  if (!existing?.length) {
    return true;
  }
  const existingScore = existing.reduce((sum, phase) => sum + scoreTicketPhase(phase), 0);
  const incomingScore = incoming.reduce((sum, phase) => sum + scoreTicketPhase(phase), 0);
  return incomingScore > existingScore;
}

export function parsePostalCodeFromAddress(address: string | undefined): string | undefined {
  if (!address?.trim()) {
    return undefined;
  }
  const match = address.match(/\b(\d{5})\b/);
  return match?.[1];
}

export function formatMinimumAgeLabel(minimumAge: number | undefined): string | undefined {
  if (minimumAge === undefined || minimumAge < 0) {
    return undefined;
  }
  return `ab ${minimumAge} Jahren`;
}

export function readCandidateMinimumAge(candidate: CanonicalImportEvent): number | undefined {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const raw = metadata?.minimumAge ?? metadata?.minimum_age;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return undefined;
}

export function readCandidateDoorsOpenAt(candidate: CanonicalImportEvent): string | undefined {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const raw = metadata?.doorsOpenAt ?? metadata?.doors_open_at;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

export function isEmptyPublishValue(value: unknown): boolean {
  return !hasMeaningfulEventValue(value);
}
