import { describe, expect, it } from 'vitest';

import { resolveConsumerTicketPresentation } from '@/features/events/tickets/consumer-ticket-safety-gate';

describe('consumer ticket safety gate', () => {
  it('shows free admission with mandatory registration, never unconditional free', () => {
    const p = resolveConsumerTicketPresentation({
      id: 'early-access', provider: 'organizer_shop',
      ticketUrl: null, priceFromMinor: 0, currency: 'EUR',
      salesStatus: 'registration_only', sortOrder: 0,
    });
    expect(p.priceText).toBe('Eintritt frei · Anmeldung erforderlich');
    expect(p.statusLabel).toBe('Registrierung erforderlich');
    expect(p.badgeStatus).toBeUndefined();
    expect(p.showPurchaseCta).toBe(false);
    expect(p.showPresaleCta).toBe(false);
    expect(p.ticketUrl).toBeUndefined();
  });
  it('shows exact zero-euro registration with event-specific ticket URL and a nonpurchase label', () => {
    const p = resolveConsumerTicketPresentation({
      id:'dyzen',provider:'ticket_io',
      ticketUrl:'https://bootshaus-club.ticket.io/UfracQzq/',
      priceFromMinor:0,currency:'EUR',salesStatus:'registration_only',sortOrder:0,
    });
    expect(p.priceText).toBe('Eintritt frei · Anmeldung erforderlich');
    expect(p.badgeStatus).toBeUndefined();
    expect(p.showPurchaseCta).toBe(false);
    expect(p.showPresaleCta).toBe(true);
    expect(p.presaleCtaLabel).toBe('Kostenloses Ticket sichern');
    expect(p.ticketUrl).toBe('https://bootshaus-club.ticket.io/UfracQzq/');
  });

  it('does not infer free registration from a generic zero price or unsafe link', () => {
    for (const invalid of [
      {priceFromMinor: null, currency: 'EUR', ticketUrl: null},
      {priceFromMinor: 0, currency: null, ticketUrl: null},
    ]) {
      const p = resolveConsumerTicketPresentation({
        id: 'invalid', provider: 'unknown', salesStatus: 'registration_only',
        sortOrder: 0, ...invalid,
      });
      expect(p.priceText).toBeUndefined();
      expect(p.badgeStatus).toBeUndefined();
    }
  });
  it('marks official sold-out events without inventing a ticket price or purchase URL', () => {
    const p = resolveConsumerTicketPresentation({
      id: 'inurfase', provider: 'organizer_shop', ticketUrl: null,
      priceFromMinor: null, currency: 'EUR', salesStatus: 'sold_out',
      sortOrder: 0,
    });
    expect(p.badgeStatus).toBe('sold_out');
    expect(p.statusLabel).toBe('Ausverkauft');
    expect(p.priceText).toBeUndefined();
    expect(p.showPurchaseCta).toBe(false);
    expect(p.ticketUrl).toBeUndefined();
  });

  it('shows time-limited free entry without a free-for-all-night badge or fake ticket CTA', () => {
    const p = resolveConsumerTicketPresentation({
      id: 'conditional', provider: 'rausgegangen',
      ticketUrl: null, priceFromMinor: null, currency: 'EUR',
      salesStatus: 'free_until_midnight', sortOrder: 0,
    });
    expect(p.priceText).toBe('Bis Mitternacht frei · danach Abendkasse');
    expect(p.badgeStatus).toBeUndefined();
    expect(p.ticketUrl).toBeUndefined();
    expect(p.showPurchaseCta).toBe(false);
    expect(p.showPresaleCta).toBe(false);
    expect(p.ticketAction).toBe('none');
  });
  it('does not turn a malformed conditional ticket into full-event free admission', () => {
    for (const row of [
      { priceFromMinor: 0, currency: 'EUR', ticketUrl: null },
      { priceFromMinor: 2500, currency: 'EUR', ticketUrl: null },
      { priceFromMinor: null, currency: 'EUR', ticketUrl: 'https://tickets.example/other' },
    ]) {
      const p = resolveConsumerTicketPresentation({
        id: 'unsafe', provider: 'rausgegangen', salesStatus: 'free_until_midnight',
        sortOrder: 0, ...row,
      });
      expect(p.priceText).toBeUndefined();
      expect(p.badgeStatus).toBeUndefined();
      expect(p.showPurchaseCta).toBe(false);
    }
  });
  it('shows door-only admission as an unknown door price, never sold out', () => {
    const p = resolveConsumerTicketPresentation({
      id: 'door', provider: 'rausgegangen', ticketUrl: null,
      priceFromMinor: null, currency: 'EUR', salesStatus: 'door_only', sortOrder: 0,
    });
    expect(p.priceText).toBe('Abendkasse · Preis unbekannt');
    expect(p.badgeStatus).toBeUndefined();
    expect(p.statusLabel).toBe('Nur Abendkasse');
    expect(p.showPurchaseCta).toBe(false);
    expect(p.ticketUrl).toBeUndefined();
  });

  it('renders explicit free admission without purchase link', () => {
    const p = resolveConsumerTicketPresentation({
      id: 'e-free', provider: 'rausgegangen', ticketUrl: null,
      priceFromMinor: 0, currency: 'EUR', salesStatus: 'free_entry', sortOrder: 0,
    });
    expect(p.priceText).toBe('Eintritt frei');
    expect(p.badgeStatus).toBe('free');
    expect(p.showPurchaseCta).toBe(false);
    expect(p.ticketUrl).toBeUndefined();
  });
  it('does not display malformed free rows as verified free', () => {
    for (const value of [
      { priceFromMinor: null, currency: 'EUR', ticketUrl: null },
      { priceFromMinor: 0, currency: null, ticketUrl: null },
      { priceFromMinor: 0, currency: 'EUR', ticketUrl: 'https://tickets.example/e/1' },
    ]) {
      const p = resolveConsumerTicketPresentation({
        id: 'invalid-free', provider: 'rausgegangen',
        salesStatus: 'free_entry', sortOrder: 0, ...value,
      });
      expect(p.priceText).toBeUndefined();
      expect(p.badgeStatus).toBeUndefined();
      expect(p.showPurchaseCta).toBe(false);
    }
  });

  it('renders a documented zero-price admission as free, not "ab 0 €"', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-free', provider: 'organizer_shop', ticketUrl: null,
      priceFromMinor: 0, currency: 'EUR', salesStatus: 'available', sortOrder: 0,
    });
    expect(presentation.priceText).toBe('Eintritt frei');
    expect(presentation.showPurchaseCta).toBe(false);
  });

  it('never treats a missing price or unverified zero as proof of free entry', () => {
    const unknown = resolveConsumerTicketPresentation({
      id: 'ticket-unknown', provider: 'organizer_shop', ticketUrl: null,
      priceFromMinor: null, currency: 'EUR', salesStatus: 'available', sortOrder: 0,
    });
    const unverified = resolveConsumerTicketPresentation({
      id: 'ticket-unverified', provider: 'organizer_shop', ticketUrl: null,
      priceFromMinor: 0, currency: 'EUR', salesStatus: 'availability_unverified', sortOrder: 0,
    });
    expect(unknown.priceText).toBeUndefined();
    expect(unverified.priceText).toBeUndefined();
  });

  it('shows a neutral ticket-page link for availability_unverified', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-1',
      provider: 'fourvenues',
      ticketUrl: 'https://site.fourvenues.com/en/bootshaus/events/test',
      priceFromMinor: null,
      currency: 'EUR',
      salesStatus: 'availability_unverified',
      sortOrder: 0,
    });

    expect(presentation.showPurchaseCta).toBe(true);
    expect(presentation.purchaseCtaLabel).toBe('Ticketseite öffnen');
    expect(presentation.ticketAction).toBe('external_link');
    expect(presentation.ticketUrl).toBe('https://site.fourvenues.com/en/bootshaus/events/test');
    expect(presentation.priceText).toBeUndefined();
    expect(presentation.badgeStatus).toBeUndefined();
    expect(presentation.statusLabel).toBe('Status unbekannt');
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
