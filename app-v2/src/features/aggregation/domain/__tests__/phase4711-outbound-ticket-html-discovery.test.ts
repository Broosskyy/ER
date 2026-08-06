import { describe, expect, it } from 'vitest';

import {
  extractOutboundTicketLinksFromHtml,
  extractRawTicketUrlsFromHtml,
} from '@/features/aggregation/domain/outbound-ticket-html-discovery';
import { pickBestOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';

describe('phase4711 outbound ticket html discovery', () => {
  it('extracts nested anchor ticket.io event links', () => {
    const html = `
      <nav><a href="https://bootshaus.ticket.io/">Shop</a></nav>
      <a href="https://bootshaus-tickets.ticket.io/YvJnLSXd/" class="button secondary fluid">Tickets</a>
    `;
    const links = extractOutboundTicketLinksFromHtml(html);
    expect(links.some((entry) => entry.class === 'ticket_io_event')).toBe(true);
    expect(pickBestOutboundTicketLink(links)?.url).toBe('https://bootshaus-tickets.ticket.io/YvJnLSXd/');
  });

  it('extracts data-attribute ticket URLs', () => {
    const html = `<button data-ticket-url="https://bootshaus-club.ticket.io/BcDqml12/">Buy</button>`;
    const urls = extractRawTicketUrlsFromHtml(html);
    expect(urls).toContain('https://bootshaus-club.ticket.io/BcDqml12/');
  });

  it('extracts ticket URL from JSON-LD offers', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Event","name":"Test","offers":{"@type":"Offer","url":"https://blacklist-festival.ticket.io/BF2Qb7HL/"}}
      </script>
    `;
    const links = extractOutboundTicketLinksFromHtml(html);
    expect(links[0]?.class).toBe('ticket_io_event');
    expect(links[0]?.url).toContain('BF2Qb7HL');
  });

  it('prefers event-specific ticket.io over shop root', () => {
    const html = `
      <a href="https://bootshaus.ticket.io/">Root</a>
      <a href="https://bootshaus-club.ticket.io/BcDqml12/">Event</a>
    `;
    const best = pickBestOutboundTicketLink(extractOutboundTicketLinksFromHtml(html));
    expect(best?.class).toBe('ticket_io_event');
    expect(best?.url).toContain('BcDqml12');
  });

  it('extracts ticket kings event URLs from HTML', () => {
    const html = `<a href="https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/">Tickets</a>`;
    const links = extractOutboundTicketLinksFromHtml(html);
    expect(links[0]?.class).toBe('ticket_kings_event');
  });
});
