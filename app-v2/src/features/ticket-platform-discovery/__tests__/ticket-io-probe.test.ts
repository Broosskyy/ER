import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { probeTicketIoShopUrl } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';

const FIXTURE_PATH = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);

vi.mock('@/features/endpoints/http/default-http-client', () => ({
  defaultHttpClient: {
    fetch: vi.fn(),
  },
}));

import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';

describe('ticket.io probe', () => {
  beforeEach(() => {
    vi.mocked(defaultHttpClient.fetch).mockReset();
  });

  it('probes shop URL with fixture HTML without publishing', async () => {
    const html = readFileSync(FIXTURE_PATH, 'utf8');
    const result = await probeTicketIoShopUrl('https://bootshaus-club.ticket.io/', undefined, {
      fixtureHtml: html,
    });

    expect(result).not.toBeNull();
    expect(result?.valid).toBe(true);
    expect(result?.shopSlug).toBe('bootshaus-club');
    expect(result?.eventCount).toBeGreaterThan(10);
    expect(result?.requiredFieldsValid).toBe(true);
    expect(result?.preview.length).toBeGreaterThan(0);
    expect(defaultHttpClient.fetch).not.toHaveBeenCalled();
  });

  it('returns invalid probe when fetch fails', async () => {
    vi.mocked(defaultHttpClient.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    } as Response);

    const result = await probeTicketIoShopUrl('https://missing-shop.ticket.io/');
    expect(result?.valid).toBe(false);
    expect(result?.eventCount).toBe(0);
    expect(result?.warnings.some((warning) => warning.includes('404'))).toBe(true);
  });

  it('rejects invalid URLs', async () => {
    const result = await probeTicketIoShopUrl('https://example.com/');
    expect(result).toBeNull();
  });
});
