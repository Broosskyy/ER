import { describe, expect, it } from 'vitest';

import { resolveConsumerTicketPresentation } from '@/features/events/tickets/consumer-ticket-safety-gate';

describe('consumer ticket safety gate', () => {
  it('blocks purchase CTA for availability_unverified', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'fourvenues',
      ticketUrl: 'https://site.fourvenues.com/en/bootshaus/events/test',
      priceFromMinor: null,
      currency: 'EUR',
      salesStatus: 'availability_unverified',
      sortOrder: 0,
    });

    expect(presentation.showPurchaseCta).toBe(false);
    expect(presentation.ticketUrl).toBeUndefined();
    expect(presentation.priceText).toBeUndefined();
    expect(presentation.statusLabel).toBe('Ticketverfügbarkeit wird geprüft');
  });

  it('shows door admission price without purchase CTA', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'organizer_shop',
      ticketUrl: undefined,
      priceFromMinor: 3500,
      currency: 'EUR',
      salesStatus: 'available',
      sortOrder: 0,
    });

    expect(presentation.showPurchaseCta).toBe(false);
    expect(presentation.ticketUrl).toBeUndefined();
    expect(presentation.priceText).toBe('ab 35 €');
  });

  it('allows purchase CTA for verified available tickets', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'ticket_io',
      ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      priceFromMinor: 1500,
      currency: 'EUR',
      salesStatus: 'available',
      sortOrder: 0,
    });

    expect(presentation.showPurchaseCta).toBe(true);
    expect(presentation.ticketUrl).toBe('https://bootshaus-club.ticket.io/tA3dBrv7/');
    expect(presentation.priceText).toBe('ab 15 €');
    expect(presentation.statusLabel).toBeUndefined();
  });

  it('hides CTA for sales_ended and shows zuletzt only when a price is persisted', () => {
    const withoutPrice = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'ticket_io',
      ticketUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
      priceFromMinor: null,
      currency: 'EUR',
      salesStatus: 'sales_ended',
      sortOrder: 0,
    });

    expect(withoutPrice.showPurchaseCta).toBe(false);
    expect(withoutPrice.ticketUrl).toBeUndefined();
    expect(withoutPrice.priceText).toBeUndefined();
    expect(withoutPrice.statusLabel).toBe('Verkauf beendet');

    const withHistorical = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'fourvenues',
      ticketUrl: 'https://site.fourvenues.com/en/bootshaus/events/ended',
      priceFromMinor: 2500,
      currency: 'EUR',
      salesStatus: 'sales_ended',
      sortOrder: 0,
    });

    expect(withHistorical.showPurchaseCta).toBe(false);
    expect(withHistorical.priceText).toBe('zuletzt ab 25 €');
    expect(withHistorical.statusLabel).toBe('Verkauf beendet');
  });

  it('shows Vorregistrieren for sold out events with registration target', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'ticket_io',
      ticketUrl: 'https://sibforms.com/serve/MUIFAexample',
      priceFromMinor: 1500,
      currency: 'EUR',
      salesStatus: 'sold_out',
      sortOrder: 0,
    });

    expect(presentation.showPurchaseCta).toBe(false);
    expect(presentation.showPresaleCta).toBe(true);
    expect(presentation.presaleCtaLabel).toBe('Vorregistrieren');
    expect(presentation.badgeStatus).toBe('sold_out');
    expect(presentation.ticketAction).toBe('pre_register');
  });
});
