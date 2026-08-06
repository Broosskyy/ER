import type { TicketAvailabilityState } from '@/features/events/domain/canonical-ticket-domain';

const AVAILABILITY_LABELS_DE: Partial<Record<TicketAvailabilityState, string>> = {
  available: 'Verfügbar',
  limited: 'Begrenzt verfügbar',
  sold_out: 'Ausverkauft',
  presale: 'Vorverkauf',
  coming_soon: 'Bald verfügbar',
  waitlist: 'Warteliste',
  sales_ended: 'Verkauf beendet',
  cancelled: 'Abgesagt',
  unavailable: 'Nicht verfügbar',
};

export function formatTicketAvailabilityLabelDe(state: TicketAvailabilityState): string | undefined {
  return AVAILABILITY_LABELS_DE[state];
}
