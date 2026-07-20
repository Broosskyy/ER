/**
 * Ticketing domain foundation (ER-005.4) — planning types only.
 *
 * Migration path: `events.ticket_url` (external link) → native ticket products.
 * No checkout, inventory, or orders in the current platform phase.
 */

export type TicketingMode = 'none' | 'external_url' | 'native';

/** Current production state: external URL on the event row. */
export interface ExternalTicketLink {
  mode: 'external_url';
  url: string;
}

/** Planned: ticket product attached to an event (Phase 1+ ticketing). */
export interface TicketProductFoundation {
  id: string;
  eventId: string;
  name: string;
  providerId?: string;
  currency?: string;
  priceCents?: number;
  capacity?: number;
  salesStartAt?: string;
  salesEndAt?: string;
}

/** Planned: third-party or native provider reference. */
export interface TicketProviderFoundation {
  id: string;
  name: string;
  type: 'native' | 'eventbrite' | 'ra' | 'custom';
}

/** Planned: issued ticket after purchase (QR validation phase). */
export interface IssuedTicketFoundation {
  id: string;
  orderId: string;
  productId: string;
  ownerUserId: string;
  qrPayload: string;
  status: 'valid' | 'used' | 'cancelled';
}

export function resolveTicketingMode(ticketUrl?: string | null): TicketingMode {
  if (!ticketUrl?.trim()) {
    return 'none';
  }

  return 'external_url';
}
