import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import type { TicketAvailabilityState } from '@/features/events/domain/canonical-ticket-domain';
import type { AdminEventTicketStatus } from '@/features/import/domain/canonical-ticket-phase';

export function normalizeCanonicalTicketAvailability(input: {
  ticketStatus?: AdminEventTicketStatus;
  ticketPhases?: CanonicalTicketPhase[];
  priceText?: string;
}): TicketAvailabilityState {
  const phases = input.ticketPhases ?? [];
  const hasPhaseSignals = phases.some(
    (phase) => phase.soldOut !== undefined || phase.available !== undefined,
  );

  if (input.ticketStatus === 'sold_out') {
    return 'sold_out';
  }
  if (input.ticketStatus === 'sales_ended') {
    return 'sales_ended';
  }
  if (hasPhaseSignals) {
    const allSoldOut = phases.every((phase) => phase.soldOut === true || phase.available === false);
    if (allSoldOut) {
      return 'sold_out';
    }
    const anyLimited = phases.some(
      (phase) => phase.available === true && phase.soldOut !== true && phase.note?.toLowerCase().includes('limit'),
    );
    if (anyLimited) {
      return 'limited';
    }
    const anyAvailable = phases.some((phase) => phase.available === true || phase.soldOut === false);
    if (anyAvailable) {
      return 'available';
    }
  }

  if (input.ticketStatus === 'on_sale') {
    return 'available';
  }
  if (input.ticketStatus === 'external_link') {
    return 'available';
  }
  if (/ausverkauft|sold\s*out/i.test(input.priceText ?? '')) {
    return 'sold_out';
  }
  if (/presale|vorverkauf/i.test(input.priceText ?? '')) {
    return 'presale';
  }
  if (/coming\s*soon|bald\s*verfügbar/i.test(input.priceText ?? '')) {
    return 'coming_soon';
  }
  if (/waitlist|warteliste/i.test(input.priceText ?? '')) {
    return 'waitlist';
  }
  if (input.ticketStatus === 'not_configured') {
    return 'unknown';
  }
  return 'unknown';
}
