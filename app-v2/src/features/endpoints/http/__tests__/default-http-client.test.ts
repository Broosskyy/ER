import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  DefaultHttpClient,
  type FetchImplementation,
} from '@/features/endpoints/http/default-http-client';
import { HttpClientError } from '@/features/endpoints/contracts/http-abstraction';

function mockFetchResponse(input: {
  status: number;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  location?: string;
}) {
  const headerMap = new Map(Object.entries(input.headers ?? {}));
  if (input.location) {
    headerMap.set('location', input.location);
  }
  return {
    ok: input.status >= 200 && input.status < 300,
    status: input.status,
    url: input.url ?? 'https://example.com/events',
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
      forEach: (cb: (value: string, key: string) => void) => {
        headerMap.forEach((value, key) => cb(value, key));
      },
    },
    text: async () => input.body ?? '',
  };
}

describe('DefaultHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns HTML for successful GET', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockFetchResponse({
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<html></html>',
      }),
    );
    const client = new DefaultHttpClient(fetchImpl);

    const response = await client.request({
      url: 'https://example.com/events',
      acceptedContentTypes: ['text/html'],
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe('<html></html>');
    expect(response.contentType).toBe('text/html');
  });

  it('rejects non-200 status codes', async () => {
    const client = new DefaultHttpClient(
      vi.fn().mockResolvedValue(mockFetchResponse({ status: 404 })),
    );

    await expect(
      client.request({ url: 'https://example.com/missing' }),
    ).rejects.toMatchObject({ code: 'HTTP_STATUS', status: 404 });
  });

  it('rejects unsupported content types', async () => {
    const client = new DefaultHttpClient(
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ),
    );

    await expect(
      client.request({
        url: 'https://example.com/data',
        acceptedContentTypes: ['text/html'],
      }),
    ).rejects.toMatchObject({ code: 'HTTP_CONTENT_TYPE' });
  });

  it('follows redirects up to maxRedirects', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 302,
          url: 'https://example.com/a',
          location: 'https://example.com/b',
        }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({
          status: 200,
          url: 'https://example.com/b',
          headers: { 'content-type': 'text/html' },
          body: '<html>ok</html>',
        }),
      );

    const client = new DefaultHttpClient(fetchImpl);
    const response = await client.request({
      url: 'https://example.com/a',
      acceptedContentTypes: ['text/html'],
      maxRedirects: 3,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.finalUrl).toBe('https://example.com/b');
  });

  it('rejects redirect loops', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockFetchResponse({
        status: 302,
        url: 'https://example.com/loop',
        location: 'https://example.com/loop',
      }),
    );
    const client = new DefaultHttpClient(fetchImpl);

    await expect(
      client.request({ url: 'https://example.com/loop', maxRedirects: 3 }),
    ).rejects.toMatchObject({ code: 'HTTP_REDIRECT_LIMIT' });
  });

  it('times out slow requests', async () => {
    const fetchImpl: FetchImplementation = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    const client = new DefaultHttpClient(fetchImpl);

    await expect(
      client.request({
        url: 'https://example.com/slow',
        timeoutMs: 25,
      }),
    ).rejects.toMatchObject({ code: 'HTTP_TIMEOUT' });
  });

  it('rejects invalid URLs', async () => {
    const client = new DefaultHttpClient(vi.fn());
    await expect(client.request({ url: 'not-a-url' })).rejects.toMatchObject({
      code: 'HTTP_INVALID_URL',
    });
  });
});
