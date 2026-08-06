import { describe, expect, it } from 'vitest';

import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';

describe('ticket kings public checkout extraction', () => {
  it('extracts native_event checkout iframe URL', () => {
    const html =
      '<iframe src="https://nacht-manager.de/ticketing/native_event.php?id=41"></iframe>';
    expect(extractNativeEventCheckoutUrl(html)).toBe(
      'https://nacht-manager.de/ticketing/native_event.php?id=41',
    );
  });

  it('parses legacy release rows with euro prices as admission tickets', () => {
    const html = `
      <div class="ticket-release">Early Bird <span>12,00 €</span></div>
      <div class="ticket-release">Standard <span>18,50 €</span></div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);
    expect(evidence.releases.length).toBeGreaterThanOrEqual(2);
    expect(evidence.priceAmount).toBe(12);
  });
});
