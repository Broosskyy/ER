import { describe, expect, it } from 'vitest';

import {
  classifyTicketIoPriceFailure,
  discoverTicketIoPriceEvidence,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { parseAllTicketIoListRowContexts } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import { normalizeCanonicalTicketAvailability } from '@/features/events/domain/canonical-ticket-availability';
import { resolveTicketProviderPresentationLabel } from '@/features/events/formatting/ticket-platform-presentation';

const BOOTSHAUS_CLUB_LIST_SNIPPET = `
<div class="row" data-search="bc173">
  <a href="/BcDqml12/" class="a-eventlink">BC173</a>
  <ul class="tio-overview">
    <li class="tio-overview-tickets-from"><span>Tickets ab 23,00 Euro</span></li>
  </ul>
</div>
<div class="row" data-search="other">
  <a href="/OtherSlug/" class="a-eventlink">Other Event</a>
  <ul class="tio-overview">
    <li class="tio-overview-tickets-from"><span>Tickets ab 40,00 Euro</span></li>
  </ul>
</div>
`;

describe('phase4741 ticket.io completion', () => {
  it('extracts modern list-row price for exact slug', () => {
    const rows = parseAllTicketIoListRowContexts(BOOTSHAUS_CLUB_LIST_SNIPPET);
    expect(rows.get('BcDqml12')?.priceText).toBe('ab 23,00 €');
  });

  it('does not assign BC173 price to a different slug', () => {
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: 'https://bootshaus-club.ticket.io/',
      listHtml: BOOTSHAUS_CLUB_LIST_SNIPPET,
      eventUrl: 'https://bootshaus-club.ticket.io/OtherSlug/',
    });
    expect(discovery.bestHit?.priceText).toBe('ab 40,00 €');
    expect(discovery.bestHit?.priceText).not.toContain('23');
  });

  it('classifies list price available but not persisted', () => {
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: 'https://bootshaus-club.ticket.io/',
      listHtml: BOOTSHAUS_CLUB_LIST_SNIPPET,
      eventUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
    });
    const classification = classifyTicketIoPriceFailure({
      hasEventSlug: true,
      isShopRootUrl: false,
      discovery,
      dbPriceText: undefined,
      canonicalPriceText: undefined,
      uiPriceVisible: false,
    });
    expect(classification.failure).toBe('LIST_PRICE_AVAILABLE_NOT_EXTRACTED');
  });

  it('normalizes sold-out list evidence', () => {
    const availability = normalizeCanonicalTicketAvailability({
      ticketStatus: 'sold_out',
      priceText: 'Ausverkauft',
    });
    expect(availability).toBe('sold_out');
  });

  it('preserves unknown when no explicit availability evidence', () => {
    const availability = normalizeCanonicalTicketAvailability({
      ticketStatus: 'not_configured',
      priceText: 'ab 23,00 €',
    });
    expect(availability).toBe('unknown');
  });

  it('always resolves Ticket.io provider label for ticket.io URLs', () => {
    const label = resolveTicketProviderPresentationLabel({
      purchaseUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      ticketPlatform: 'ticket.io',
    });
    expect(label).toBe('Ticket.io');
  });
});
