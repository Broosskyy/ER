import { describe, expect, it } from 'vitest';

import {
  resolveTicketProviderDisplayLabel,
  resolveTicketProviderPresentationLabel,
} from '@/features/events/formatting/ticket-platform-presentation';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';

describe('phase472 ticket platform presentation', () => {
  it('derives Ticket.io from purchase URL regardless of Bootshaus source', () => {
    const label = resolveTicketProviderPresentationLabel({
      purchaseUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      ticketPlatform: 'ticket.io',
      sourceAttributionLabel: getSourceDisplayLabel('source-bootshaus-koeln'),
    });
    expect(label).toBe('Ticket.io');
  });

  it('derives Ticket Kings from ticketkings URL', () => {
    expect(
      resolveTicketProviderDisplayLabel({
        purchaseUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/',
        ticketPlatform: 'ticket_kings',
      }),
    ).toBe('Ticket Kings');
  });

  it('does not use organizer/source as ticket platform when URL is ticket.io', () => {
    const sourceLabel = getSourceDisplayLabel('source-bootshaus-koeln');
    expect(sourceLabel).toBe('Bootshaus');
    const ticketLabel = resolveTicketProviderPresentationLabel({
      purchaseUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      ticketPlatform: 'ticket.io',
      sourceAttributionLabel: sourceLabel,
    });
    expect(ticketLabel).not.toBe('Bootshaus');
    expect(ticketLabel).toBe('Ticket.io');
  });

  it('uses Veranstalterseite for official event page only', () => {
    expect(
      resolveTicketProviderDisplayLabel({
        purchaseUrl: 'https://bootshaus.tv/events/example',
        destinationClass: 'official_event_page',
      }),
    ).toBe('Veranstalterseite');
  });
});
