import type { NormalizedTicketStatus, VerifiedTicketStatus } from './types';
import { toConsumerNormalizedStatus } from './normalize-ticket-status';

const BADGE_BY_STATUS: Record<NormalizedTicketStatus, string> = {
  available: 'Tickets verfügbar',
  sale_not_started: 'Verkauf startet bald',
  sold_out: 'Ausverkauft',
  sales_ended: 'Verkauf beendet',
  cancelled: 'Abgesagt',
};

export function projectTicketStatusBadge(status: VerifiedTicketStatus): string | undefined {
  const normalized = toConsumerNormalizedStatus(status);
  if (!normalized) {
    return undefined;
  }
  return BADGE_BY_STATUS[normalized];
}

export function projectStatusLabel(status: VerifiedTicketStatus): string {
  const badge = projectTicketStatusBadge(status);
  return badge ?? status;
}

export function isConsumerReadyTicketStatus(status: VerifiedTicketStatus): boolean {
  return toConsumerNormalizedStatus(status) !== undefined;
}
