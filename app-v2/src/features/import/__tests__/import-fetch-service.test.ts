import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertSafeImportUrl,
  ImportFetchService,
} from '@/features/import/services/import-fetch-service';

describe('ImportFetchService', () => {
  const fetchService = new ImportFetchService();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches successful response', async () => {
    const payload = new TextEncoder().encode('<rss></rss>');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/feed.xml',
        headers: { get: () => 'application/xml' },
        body: {
          getReader: () => {
            let sent = false;
            return {
              async read() {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: payload };
              },
            };
          },
        },
      }),
    );

    const response = await fetchService.fetch({ url: 'https://example.com/feed.xml' });
    expect(response.status).toBe(200);
    expect(response.body).toContain('rss');
  });

  it('blocks localhost', () => {
    expect(() => assertSafeImportUrl('http://localhost/events')).toThrow(/Blocked hostname/);
  });

  it('blocks private IPv4', () => {
    expect(() => assertSafeImportUrl('http://192.168.1.1/events')).toThrow(/Blocked private address/);
  });

  it('blocks invalid protocol', () => {
    expect(() => assertSafeImportUrl('file:///etc/passwd')).toThrow(/Blocked protocol/);
  });

  it('blocks javascript protocol', () => {
    expect(() => assertSafeImportUrl('javascript:alert(1)')).toThrow(/Blocked protocol/);
  });

  it('rejects oversized response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/big',
        headers: { get: () => 'text/plain' },
        body: {
          getReader: () => {
            let sent = false;
            return {
              async read() {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: new Uint8Array(6 * 1024 * 1024) };
              },
            };
          },
        },
      }),
    );

    await expect(fetchService.fetch({ url: 'https://example.com/big' })).rejects.toThrow(/maximum allowed size/);
  });

  it('blocks redirect to private address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        headers: { get: (name: string) => (name.toLowerCase() === 'location' ? 'http://127.0.0.1/internal' : null) },
      }),
    );

    await expect(fetchService.fetch({ url: 'https://example.com/redirect' })).rejects.toThrow(/Blocked/);
  });

  it('rejects unexpected content type when restricted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/data',
        headers: { get: () => 'text/html' },
        text: async () => '<html></html>',
      }),
    );

    await expect(
      fetchService.fetch({
        url: 'https://example.com/data',
        allowedContentTypes: ['application/json'],
      }),
    ).rejects.toThrow(/Unexpected content type/);
  });
});
