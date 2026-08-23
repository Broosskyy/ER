import { afterEach, describe, expect, it, vi } from 'vitest';

import { bootshausSafeFetchPolicy } from '../bootshaus/fetch-policy';
import {
  SafeFetchError,
  safeFetchHtmlWithPolicy,
  type SafeFetchPolicyCounters,
  type SafeFetchUrlPolicy,
} from '../generic-safe-fetch';

function emptyCounters(): SafeFetchPolicyCounters {
  return {
    nonHttpsFetches: 0,
    crossOriginDetailFetches: 0,
    disallowedPathFetches: 0,
  };
}

const testPolicy: SafeFetchUrlPolicy = {
  userAgent: 'TestFetcher/1.0',
  canonicalizeUrl(rawUrl: string) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') {
        return null;
      }
      if (parsed.hostname !== 'allowed.example') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  },
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null) {
    if (!locationHeader) {
      return null;
    }
    try {
      return new URL(locationHeader, currentUrl).toString();
    } catch {
      return null;
    }
  },
  validateRequestUrl(url: string) {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/allowed/')) {
      return 'disallowed_path';
    }
    return null;
  },
};

describe('generic safe fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects disallowed hosts during canonicalization', async () => {
    const counters = emptyCounters();
    await expect(
      safeFetchHtmlWithPolicy('https://evil.example/allowed/page', testPolicy, { counters }),
    ).rejects.toMatchObject({ code: 'non_https' });
    expect(counters.nonHttpsFetches).toBe(1);
  });

  it('rejects http urls', async () => {
    const counters = emptyCounters();
    await expect(
      safeFetchHtmlWithPolicy('http://allowed.example/allowed/page', testPolicy, { counters }),
    ).rejects.toMatchObject({ code: 'non_https' });
    expect(counters.nonHttpsFetches).toBe(1);
  });

  it('rejects disallowed paths before fetch', async () => {
    const counters = emptyCounters();
    await expect(
      safeFetchHtmlWithPolicy('https://allowed.example/forbidden/page', testPolicy, { counters }),
    ).rejects.toMatchObject({ code: 'disallowed_path' });
    expect(counters.disallowedPathFetches).toBe(1);
  });

  it('follows redirects until the redirect limit', async () => {
    const counters = emptyCounters();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/1')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://allowed.example/allowed/2' },
        });
      }
      if (url.endsWith('/2')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://allowed.example/allowed/3' },
        });
      }
      if (url.endsWith('/3')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://allowed.example/allowed/4' },
        });
      }
      return new Response('<html>ok</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      safeFetchHtmlWithPolicy('https://allowed.example/allowed/1', testPolicy, {
        counters,
        maxRedirects: 2,
      }),
    ).rejects.toMatchObject({ code: 'redirect_loop' });
  });

  it('times out slow responses', async () => {
    vi.useFakeTimers();
    const counters = emptyCounters();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
      ),
    );

    const promise = safeFetchHtmlWithPolicy('https://allowed.example/allowed/page', testPolicy, {
      counters,
      timeoutMs: 20,
    });
    const assertion = expect(promise).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    vi.useRealTimers();
  });

  it('rejects oversized responses', async () => {
    const counters = emptyCounters();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(32));
        controller.enqueue(new Uint8Array(32));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(body, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        ),
      ),
    );

    await expect(
      safeFetchHtmlWithPolicy('https://allowed.example/allowed/page', testPolicy, {
        counters,
        maxBytes: 16,
      }),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('keeps bootshaus policy functional for list and detail urls', async () => {
    const counters = emptyCounters();
    const html = '<html><body>bootshaus</body></html>';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        ),
      ),
    );

    const listResult = await safeFetchHtmlWithPolicy(
      'https://bootshaus.tv/events/',
      bootshausSafeFetchPolicy,
      { counters },
      { allowListOnly: true },
    );
    expect(listResult.finalUrl).toBe('https://bootshaus.tv/events/');
    expect(listResult.html).toContain('bootshaus');

    const detailResult = await safeFetchHtmlWithPolicy(
      'https://bootshaus.tv/events/sample-event/',
      bootshausSafeFetchPolicy,
      { counters },
      { allowDetailOnly: true },
    );
    expect(detailResult.finalUrl).toBe('https://bootshaus.tv/events/sample-event/');
  });

  it('surfaces SafeFetchError for non-html responses', async () => {
    const counters = emptyCounters();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    await expect(
      safeFetchHtmlWithPolicy('https://allowed.example/allowed/page', testPolicy, { counters }),
    ).rejects.toBeInstanceOf(SafeFetchError);
  });
});
