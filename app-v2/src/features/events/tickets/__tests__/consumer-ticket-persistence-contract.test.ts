import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveConsumerTicketPresentation } from '@/features/events/tickets/consumer-ticket-safety-gate';

describe('consumer ticket persistence contract', () => {
  it('projects a persisted event_tickets price after restart without extra flags', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-loonyland',
      provider: 'ticket_io',
      ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      priceFromMinor: 2590,
      currency: 'EUR',
      salesStatus: 'available',
      sortOrder: 0,
    });
    expect(presentation.priceText).toBe('ab 25,90 €');
    expect(presentation.showPurchaseCta).toBe(true);
  });

  it('hides a numeric price when the persisted amount is null', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-polyamor',
      provider: 'ticket_io',
      ticketUrl: 'https://polyamor.ticket.io/PDikPg1v/',
      priceFromMinor: null,
      currency: 'EUR',
      salesStatus: 'available',
      sortOrder: 0,
    });
    expect(presentation.priceText).toBeUndefined();
    expect(presentation.showPurchaseCta).toBe(true);
    expect(presentation.ticketUrl).toBe('https://polyamor.ticket.io/PDikPg1v/');
  });

  it('keeps BC173 Airport Session CTA without an unnamed Admission price', () => {
    const presentation = resolveConsumerTicketPresentation({
      id: 'ticket-airport',
      provider: 'ticket_io',
      ticketUrl: 'https://bootshaus-club.ticket.io/fjspvLe4/',
      priceFromMinor: null,
      currency: 'EUR',
      salesStatus: 'available',
      sortOrder: 0,
    });
    expect(presentation.priceText).toBeUndefined();
    expect(presentation.showPurchaseCta).toBe(true);
    expect(presentation.ticketUrl).toContain('fjspvLe4');
  });
});

describe('consumer path has no audit-file coupling', () => {
  it('does not import tmp write plans, fixtures, or audit maps', () => {
    const files = [
      'src/features/events/tickets/consumer-ticket-safety-gate.ts',
      'src/features/events/tickets/consumer-ticket-status-label.ts',
      'src/data/mappers/event-core-mapper.ts',
      'src/data/mappers/event-core-display.ts',
      'src/data/repositories/event-core-read.ts',
      'src/features/event-detail/event-detail-visible-surface.ts',
      'src/features/event-detail/components/EventDetailContent.tsx',
      'src/features/events/sources/consumer-official-source.ts',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\.tmp[\\/]/);
      expect(source).not.toMatch(/write-plan|writePlan|m6-8h|m6-8i|PUBLIC_CATALOGS|namedRegularAdmissionProduct/);
    }
  });
});
