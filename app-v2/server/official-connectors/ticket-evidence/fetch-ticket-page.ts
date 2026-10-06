import { createHash } from 'node:crypto';

import type { TicketFetchResult } from './types';
import { isCheckoutOrSessionTicketUrl, isShopRootUrl } from './url-policy';
import { isTicketProviderBlockedBody } from './safe-fetch-ticket';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 3_000_000;
const DEFAULT_MAX_REDIRECTS = 5;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fingerprintBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export async function fetchTicketPage(initialUrl: string): Promise<TicketFetchResult> {
  const redirectChain: string[] = [initialUrl];

  if (!/^https:\/\//i.test(initialUrl)) {
    return {
      finalUrl: initialUrl,
      body: '',
      contentType: '',
      fingerprint: '',
      blocked: true,
      blockReason: 'non_https',
      redirectChain,
    };
  }

  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= DEFAULT_MAX_REDIRECTS; redirectCount += 1) {
    if (isCheckoutOrSessionTicketUrl(currentUrl) || isShopRootUrl(currentUrl)) {
      return {
        finalUrl: currentUrl,
        body: '',
        contentType: '',
        fingerprint: '',
        blocked: true,
        blockReason: 'host_not_allowed',
        redirectChain,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount === DEFAULT_MAX_REDIRECTS) {
          return {
            finalUrl: currentUrl,
            body: '',
            contentType: '',
            fingerprint: '',
            blocked: true,
            blockReason: 'redirect_limit',
            redirectChain,
          };
        }
        const nextUrl = new URL(location, currentUrl).toString();
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        return {
          finalUrl: currentUrl,
          body: '',
          contentType: response.headers.get('content-type') ?? '',
          fingerprint: '',
          blocked: true,
          blockReason: 'http_error',
          redirectChain,
        };
      }

      const contentType = response.headers.get('content-type') ?? '';
      const isHtml = contentType.includes('text/html');
      const isJson = contentType.includes('application/json');
      if (!isHtml && !isJson) {
        return {
          finalUrl: currentUrl,
          body: '',
          contentType,
          fingerprint: '',
          blocked: true,
          blockReason: 'invalid_mime',
          redirectChain,
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return {
          finalUrl: currentUrl,
          body: '',
          contentType,
          fingerprint: '',
          blocked: true,
          blockReason: 'http_error',
          redirectChain,
        };
      }

      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        total += value.byteLength;
        if (total > DEFAULT_MAX_BYTES) {
          return {
            finalUrl: currentUrl,
            body: '',
            contentType,
            fingerprint: '',
            blocked: true,
            blockReason: 'too_large',
            redirectChain,
          };
        }
        chunks.push(value);
      }

      const body = Buffer.concat(chunks).toString('utf8');
      const fingerprint = fingerprintBody(body);
      const blocked = isTicketProviderBlockedBody(body, contentType);
      return {
        finalUrl: currentUrl,
        body,
        contentType,
        fingerprint,
        blocked,
        blockReason: blocked ? 'bot_protection' : undefined,
        redirectChain,
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return {
        finalUrl: currentUrl,
        body: '',
        contentType: '',
        fingerprint: '',
        blocked: true,
        blockReason: isTimeout ? 'timeout' : 'http_error',
        redirectChain,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    finalUrl: currentUrl,
    body: '',
    contentType: '',
    fingerprint: '',
    blocked: true,
    blockReason: 'redirect_limit',
    redirectChain,
  };
}
