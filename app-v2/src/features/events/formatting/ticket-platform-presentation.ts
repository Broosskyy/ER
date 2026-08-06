import type { TicketDestinationClass } from '@/features/events/domain/canonical-ticket-domain';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';

const PLATFORM_LABELS_DE: Record<string, string> = {
  'ticket.io': 'Ticket.io',
  ticket_io: 'Ticket.io',
  ticket_kings: 'Ticket Kings',
  eventim: 'Eventim',
  reservix: 'Reservix',
  dice: 'Dice',
  shotgun: 'Shotgun',
  fourvenues: 'Fourvenues',
};

export function resolveTicketPlatformSlug(
  purchaseUrl: string | undefined,
  ticketPlatform?: string,
): string | undefined {
  if (ticketPlatform?.trim()) {
    return ticketPlatform.trim().toLowerCase();
  }
  if (!purchaseUrl?.trim()) {
    return undefined;
  }
  return classifyTicketDestination(purchaseUrl).ticketPlatform;
}

export function resolveTicketProviderDisplayLabel(input: {
  purchaseUrl?: string;
  ticketPlatform?: string;
  destinationClass?: TicketDestinationClass;
}): string | undefined {
  const classified = input.purchaseUrl
    ? classifyTicketDestination(input.purchaseUrl)
    : undefined;
  const destinationClass = input.destinationClass ?? classified?.destinationClass;
  const platformSlug = resolveTicketPlatformSlug(input.purchaseUrl, input.ticketPlatform ?? classified?.ticketPlatform);

  if (platformSlug && PLATFORM_LABELS_DE[platformSlug]) {
    return PLATFORM_LABELS_DE[platformSlug];
  }

  if (platformSlug === 'ticket.io' || /ticket\.io/i.test(input.purchaseUrl ?? '')) {
    return 'Ticket.io';
  }
  if (platformSlug === 'ticket_kings' || /ticketkings\.de/i.test(input.purchaseUrl ?? '')) {
    return 'Ticket Kings';
  }
  if (/fourvenues\.com/i.test(input.purchaseUrl ?? '')) {
    return 'Fourvenues';
  }
  if (/eventim\./i.test(input.purchaseUrl ?? '')) {
    return 'Eventim';
  }
  if (/reservix\./i.test(input.purchaseUrl ?? '')) {
    return 'Reservix';
  }

  if (destinationClass === 'official_event_page') {
    return 'Veranstalterseite';
  }
  if (destinationClass === 'organizer_or_venue_homepage') {
    return 'Veranstalterseite';
  }

  return undefined;
}

export function resolveTicketProviderPresentationLabel(input: {
  purchaseUrl?: string;
  ticketPlatform?: string;
  destinationClass?: TicketDestinationClass;
  sourceAttributionLabel?: string;
}): string {
  const platformLabel = resolveTicketProviderDisplayLabel(input);
  if (platformLabel) {
    return platformLabel;
  }
  if (input.destinationClass === 'official_event_page' || input.destinationClass === 'organizer_or_venue_homepage') {
    return 'Veranstalterseite';
  }
  return input.sourceAttributionLabel ?? 'Externe Quelle';
}
