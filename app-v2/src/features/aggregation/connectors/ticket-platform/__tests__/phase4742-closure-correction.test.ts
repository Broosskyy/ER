import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { auditTicketIoShopAvailabilityEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-shop-availability-evidence';
import {
  classifyPersistedNachtManagerUrl,
  detectEventNotFoundResponse,
  extractTicketKingsCheckoutEmbedEvidence,
  isBrokenTicketKingsCheckoutClass,
  resolveTicketKingsOfficialFallbackUrl,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-checkout-url-integrity';
import { parseTicketKingsCheckoutHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';

const FIXTURE_FLEX = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-admission-flex-checkout.html',
);
const FIXTURE_SOMMERFEST = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-sommerfest-detail.html',
);

describe('phase4742 closure correction', () => {
  it('rejects shop-level Ticket.io availability without event-specific identity', () => {
    const listHtml = `
      <script type="application/ld+json">{"@type":"Offer","availability":"InStock","price":"3.00"}</script>
      <td id="event-row-Abcdef12"><span>Other Event</span></td>
    `;
    const audit = auditTicketIoShopAvailabilityEvidence({
      eventId: 'evt-test',
      title: '122 pres. JUNO @ Palma de Mallorca (ES)',
      ticketUrl: 'https://bootshaus.ticket.io/',
      listHtml,
    });
    expect(audit.eventSpecific).toBe(false);
    expect(audit.rejectionReason).toBe('shop_level_signal_not_event_specific');
    expect(audit.shopLevelSignals).toContain('shop_wide_json_ld_offer');
  });

  it('accepts event-specific Ticket.io list-row identity', () => {
    const listHtml = `
      <td id="event-row-JunoSlug1">
        <span>122 pres. JUNO @ Palma de Mallorca (ES)</span>
        <li class="tio-overview-tickets-from"><span>ab 45,00 €</span></li>
      </td>
    `;
    const audit = auditTicketIoShopAvailabilityEvidence({
      eventId: 'evt-test',
      title: '122 pres. JUNO @ Palma de Mallorca (ES)',
      ticketUrl: 'https://bootshaus.ticket.io/JunoSlug1/',
      listHtml,
    });
    expect(audit.eventSpecific).toBe(true);
    expect(audit.strongIdentitySignals).toContain('event_slug_in_url');
  });

  it('classifies bare native_event.php as generic/broken', () => {
    expect(classifyPersistedNachtManagerUrl('https://nacht-manager.de/ticketing/native_event.php')).toBe(
      'generic_endpoint',
    );
    expect(
      isBrokenTicketKingsCheckoutClass(
        classifyPersistedNachtManagerUrl('https://nacht-manager.de/ticketing/native_event.php'),
      ),
    ).toBe(true);
  });

  it('preserves required query parameters on embedded checkout URLs', () => {
    const url =
      'https://nacht-manager.de/ticketing/native_event.php?id=41&embed=1&embed_layout=checkout&embed_flow=stepped&return_url=https%3A%2F%2Fticketkings.de%2Forder_success%2F';
    expect(classifyPersistedNachtManagerUrl(url)).toBe('valid_embedded_checkout');
  });

  it('extracts iframe event context and hidden form evidence', () => {
    const embed = extractTicketKingsCheckoutEmbedEvidence(readFileSync(FIXTURE_SOMMERFEST, 'utf8'));
    expect(embed.checkoutUrl).toContain('native_event.php?id=41');
    expect(embed.nativeEventId).toBe('41');
    expect(embed.iframeSrcs[0]).toContain('id=41');
  });

  it('detects Event-not-found checkout responses', () => {
    expect(detectEventNotFoundResponse('<html>Event nicht gefunden.</html>')).toBe(true);
  });

  it('excludes Flex Option from admission summary', () => {
    const evidence = parseTicketKingsCheckoutHtml(readFileSync(FIXTURE_FLEX, 'utf8'));
    const flex = evidence.excludedProducts.find((product) => /flex/i.test(product.rawProductName));
    expect(flex?.classification).toBe('insurance_or_flex');
    expect(evidence.priceAmount).toBeGreaterThan(2.5);
    expect(evidence.excludedProducts.some((product) => product.priceAmount === 2.5)).toBe(true);
  });

  it('uses stable Ticket Kings event page as truthful fallback', () => {
    expect(
      resolveTicketKingsOfficialFallbackUrl(
        'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/',
        'https://affenkaefig.info/event/sommerfest',
      ),
    ).toBe('https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/');
  });
});
