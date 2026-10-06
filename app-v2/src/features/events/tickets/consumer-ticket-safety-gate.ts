import type { EventTicket } from '@/features/events/types/event-core';
import type { EventTicketStatus } from '@/components/discovery/view-models';
import { projectConsumerTicketStatusLabel } from './consumer-ticket-status-label';

export type ConsumerTicketAction = 'purchase' | 'pre_register' | 'waitlist' | 'door_only' | 'none';

export interface ConsumerTicketPresentation {
  priceText?: string;
  ticketUrl?: string;
  showPurchaseCta: boolean;
  showPresaleCta: boolean;
  purchaseCtaLabel?: string;
  presaleCtaLabel?: string;
  ticketStatus?: 'on_sale' | 'sold_out' | 'external_link';
  statusLabel?: string;
  badgeStatus?: EventTicketStatus;
  ticketAction: ConsumerTicketAction;
}

const BLOCKED_SALES_STATUSES = new Set([
  'availability_unverified',
  'sales_ended',
  'sale_not_started',
  'sold_out',
]);

const REGISTRATION_URL_PATTERN =
  /sibforms\.com|mailchimp|newsletter|waitlist|vormerken|presale.?reg|pre-?register|registrier/i;

function isRegistrationTargetUrl(url: string | null | undefined): boolean {
  return Boolean(url && REGISTRATION_URL_PATTERN.test(url));
}

function resolveTicketAction(
  salesStatus: string,
  ticketUrl: string | null | undefined,
): ConsumerTicketAction {
  if (!ticketUrl?.startsWith('https://')) {
    return 'none';
  }
  if (isRegistrationTargetUrl(ticketUrl)) {
    return 'pre_register';
  }
  if (salesStatus === 'presale_registration' || salesStatus === 'registration_only') {
    return 'pre_register';
  }
  if (salesStatus === 'door_only') {
    return 'door_only';
  }
  if (salesStatus === 'sold_out') {
    return 'none';
  }
  if (salesStatus === 'available' || salesStatus === 'on_sale' || salesStatus === 'low_availability') {
    return 'purchase';
  }
  return 'none';
}

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

export function mapConsumerSalesStatusToBadgeStatus(
  salesStatus: string | null | undefined,
): EventTicketStatus | undefined {
  switch (salesStatus) {
    case 'available':
      return 'available';
    case 'on_sale':
      return 'on_sale';
    case 'low_availability':
      return 'limited';
    case 'sold_out':
      return 'sold_out';
    case 'sale_not_started':
      return 'coming_soon';
    case 'sales_ended':
      return 'expired';
    case 'presale_registration':
      return 'presale';
    case 'registration_only':
      return 'waitlist';
    case 'door_only':
      return 'unavailable';
    case 'cancelled':
      return 'cancelled';
    case 'availability_unverified':
    case 'provider_access_unavailable':
    case 'unavailable_unknown':
      return 'unavailable';
    default:
      return undefined;
  }
}

export function resolveConsumerTicketPresentation(ticket: EventTicket | null): ConsumerTicketPresentation {
  if (!ticket) {
    return {
      showPurchaseCta: false,
      showPresaleCta: false,
      ticketAction: 'none',
    };
  }

  const salesStatus = ticket.salesStatus ?? '';
  const hasUrl = Boolean(ticket.ticketUrl?.startsWith('https://'));
  const ticketAction = resolveTicketAction(salesStatus, ticket.ticketUrl);
  const registrationTarget = isRegistrationTargetUrl(ticket.ticketUrl);
  const showPresaleCta =
    hasUrl &&
    (ticketAction === 'pre_register' || (salesStatus === 'sold_out' && registrationTarget));
  const showPurchaseCta =
    hasUrl &&
    ticketAction === 'purchase' &&
    !BLOCKED_SALES_STATUSES.has(salesStatus) &&
    (salesStatus === 'available' || salesStatus === 'on_sale' || salesStatus === 'low_availability');

  let ticketStatus: ConsumerTicketPresentation['ticketStatus'];
  if (showPurchaseCta) {
    ticketStatus = 'on_sale';
  } else if (hasUrl) {
    ticketStatus = salesStatus === 'sold_out' ? 'sold_out' : 'external_link';
  }

  return {
    priceText: projectPriceText(ticket),
    ticketUrl: showPurchaseCta || showPresaleCta ? ticket.ticketUrl ?? undefined : undefined,
    showPurchaseCta,
    showPresaleCta,
    purchaseCtaLabel: showPurchaseCta ? 'Tickets kaufen' : undefined,
    presaleCtaLabel: showPresaleCta ? 'Vorregistrieren' : undefined,
    ticketStatus,
    statusLabel: projectConsumerTicketStatusLabel(salesStatus),
    badgeStatus: mapConsumerSalesStatusToBadgeStatus(salesStatus),
    ticketAction,
  };
}
