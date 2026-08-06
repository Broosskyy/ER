import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';

export const PHASE48651_EVENT_ID = 'evt-1785389049895-4mb7dub';
export const PHASE48651_TICKET_URL =
  'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/';
export const PHASE48651_PRICE_TEXT = 'ab 15,00 €';
export const PHASE48651_PHASE_NAME = 'E-Ticket — Early Bird';
export const PHASE48651_PHASE_AMOUNT = 15;
export const PHASE48651_PHASE_CURRENCY = 'EUR';
export const PHASE48651_PROVENANCE_SOURCE_ID = 'source-affenkaefig-ticket-kings';
export const PHASE48651_APPLY_ENV = 'PHASE48651_APPLY_APPROVED';

export function buildApprovedUnderlandAdmissionPhase(): CanonicalTicketPhase {
  return {
    id: 'underland-e-ticket-early-bird',
    name: PHASE48651_PHASE_NAME,
    sortOrder: 0,
    kind: 'early_bird',
    priceAmount: PHASE48651_PHASE_AMOUNT,
    priceCurrency: PHASE48651_PHASE_CURRENCY,
    priceLabel: PHASE48651_PRICE_TEXT,
    soldOut: false,
    available: true,
  };
}

export type UnderlandPriceMutation = {
  field: 'priceText' | 'ticketPhases';
  previousValue: unknown;
  newValue: unknown;
  reason: string;
};

export function planUnderlandPriceMutations(event: {
  priceText?: string;
  ticketPhases?: CanonicalTicketPhase[];
}): UnderlandPriceMutation[] {
  const mutations: UnderlandPriceMutation[] = [];
  const phase = buildApprovedUnderlandAdmissionPhase();

  if ((event.priceText ?? '').trim() !== PHASE48651_PRICE_TEXT) {
    mutations.push({
      field: 'priceText',
      previousValue: event.priceText ?? '',
      newValue: PHASE48651_PRICE_TEXT,
      reason: 'Persist verified Nacht-Manager Early Bird admission minimum',
    });
  }

  const existing = event.ticketPhases ?? [];
  const matches =
    existing.length === 1 &&
    existing[0]?.name === phase.name &&
    existing[0]?.priceAmount === phase.priceAmount &&
    existing[0]?.priceLabel === phase.priceLabel;

  if (!matches) {
    mutations.push({
      field: 'ticketPhases',
      previousValue: existing,
      newValue: [phase],
      reason: 'Persist single admission phase from Ticket Kings/Nacht-Manager checkout',
    });
  }

  return mutations;
}

export function phasesSemanticallyEqual(
  left: CanonicalTicketPhase[] | undefined,
  right: CanonicalTicketPhase[] | undefined,
): boolean {
  const normalize = (phases: CanonicalTicketPhase[] | undefined) =>
    (phases ?? []).map((p) => ({
      name: p.name,
      priceAmount: p.priceAmount,
      priceLabel: p.priceLabel,
      kind: p.kind,
      soldOut: p.soldOut,
      available: p.available,
    }));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
