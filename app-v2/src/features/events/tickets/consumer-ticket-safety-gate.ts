import type { EventTicket } from '@/features/events/types/event-core';
import { projectConsumerTicketStatusLabel } from './consumer-ticket-status-label';

export interface ConsumerTicketPresentation {
  priceText?: string;
  ticketUrl?: string;
  showPurchaseCta: boolean;
  showPresaleCta: boolean;
  purchaseCtaLabel?: string;
  presaleCtaLabel?: string;
  ticketStatus?: 'on_sale' | 'sold_out' | 'external_link';
  statusLabel?: string;
}

const BLOCKED_SALES_STATUSES = new Set([
  'availability_unverified',
  'sales_ended',
  'sale_not_started',
  'sold_out',
]);

function formatMinorAsEuro(amountMinor: number): string {
  const amount = amountMinor / 100;
  if (Number.isInteger(amount)) {
    return `ab ${amount} €`;
  }
  const formatted = amount.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `ab ${formatted} €`;
}

function projectPriceText(ticket: EventTicket): string | undefined {
  const salesStatus = ticket.salesStatus ?? '';
  if (salesStatus === 'availability_unverified') {
    return undefined;
  }
  if (salesStatus === 'sale_not_started' && ticket.priceFromMinor == null) {
    return 'Preis noch nicht veröffentlicht';
  }
  if (salesStatus === 'sales_ended' && ticket.priceFromMinor != null) {
    return `zuletzt ${formatMinorAsEuro(ticket.priceFromMinor)}`;
  }
  if (ticket.priceFromMinor != null) {
    return formatMinorAsEuro(ticket.priceFromMinor);
  }
  return undefined;
}

export function resolveConsumerTicketPresentation(ticket: EventTicket | null): ConsumerTicketPresentation {
  if (!ticket) {
    return {
      showPurchaseCta: false,
      showPresaleCta: false,
    };
  }

  const salesStatus = ticket.salesStatus ?? '';
  const hasUrl = Boolean(ticket.ticketUrl?.startsWith('https://'));
  const showPurchaseCta =
    hasUrl &&
    !BLOCKED_SALES_STATUSES.has(salesStatus) &&
    (salesStatus === 'available' || salesStatus === 'on_sale');
  const showPresaleCta = hasUrl && salesStatus === 'presale_registration';

  let ticketStatus: ConsumerTicketPresentation['ticketStatus'];
  if (showPurchaseCta) {
    ticketStatus = 'on_sale';
  } else if (hasUrl) {
    ticketStatus = 'external_link';
  }

  return {
    priceText: projectPriceText(ticket),
    ticketUrl: showPurchaseCta || showPresaleCta ? ticket.ticketUrl ?? undefined : undefined,
    showPurchaseCta,
    showPresaleCta,
    purchaseCtaLabel: showPurchaseCta ? 'Tickets kaufen' : undefined,
    presaleCtaLabel: showPresaleCta ? 'Zum Vorverkauf vormerken' : undefined,
    ticketStatus,
    statusLabel: projectConsumerTicketStatusLabel(salesStatus),
  };
}
