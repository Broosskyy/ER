import type { EventTicketStatus } from '@/components/discovery/view-models';
import type { TicketAvailabilityState } from '@/features/events/domain/canonical-ticket-domain';
import type { AdminEventTicketStatus } from '@/features/import/domain/canonical-ticket-phase';

/** Maps canonical ticket availability to discovery ticket badge status. */
export function mapCanonicalAvailabilityToTicketBadge(
  availability: TicketAvailabilityState,
  ticketStatus?: AdminEventTicketStatus,
): EventTicketStatus | undefined {
  switch (availability) {
    case 'sold_out':
      return 'sold_out';
    case 'limited':
      return 'limited';
    case 'presale':
      return 'presale';
    case 'coming_soon':
      return 'coming_soon';
    case 'waitlist':
      return 'waitlist';
    case 'unavailable':
    case 'sales_ended':
      return 'unavailable';
    case 'available':
      return ticketStatus === 'on_sale' ? 'on_sale' : 'available';
    default:
      return undefined;
  }
}
