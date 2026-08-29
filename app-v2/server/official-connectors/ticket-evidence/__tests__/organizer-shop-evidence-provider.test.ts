import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OrganizerShopEvidenceProvider } from '../organizer-shop-evidence-provider';

describe('OrganizerShop evidence provider', () => {
  it('parses n8manager native_event embed bodies for admission offers', async () => {
    const body = readFileSync(join(process.cwd(), '.tmp/m9-2-2-3-n8manager-14jahre.html'), 'utf8');
    const provider = new OrganizerShopEvidenceProvider();
    const url = new URL(
      'https://rheinaudio.n8manager.de/ticketing/native_event.php?id=21&embed=1&embed_layout=checkout&embed_flow=stepped',
    );
    const evidence = await provider.fetchEventEvidence({
      url,
      canonicalTicketUrl: url.toString(),
      redirectChain: [url.toString()],
      body,
      contentType: 'text/html',
      fingerprint: 'fixture',
      observedAt: '2026-08-29T12:00:00.000Z',
      extractedAt: '2026-08-29T12:00:00.000Z',
    });

    expect(evidence.tickets.offers.length).toBeGreaterThan(0);
    expect(evidence.tickets.offers[0]?.amountMinor).toBe(2500);
    expect(evidence.tickets.normalizedStatus).toBe('available');
  });
});
