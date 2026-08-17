import { createHash } from 'node:crypto';

import type { TicketFetchResult } from './types';
import { canonicalizeTicketIoUrl, isCheckoutOrSessionTicketUrl } from './url-policy';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_REDIRECTS = 3;
const USER_AGENT = 'EternalRave/0.2.0 (bootshaus-m6-ticket-evidence; contact@eternal-rave.local)';

const BOT_PROTECTION_PATTERN =
  /<title>\s*Security check\.\.\.\s*<\/title>|altcha|cf-browser-verification|captcha|Nur einen Moment|Just a moment/i;

function fingerprintBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export function isTicketProviderBlockedBody(body: string, contentType: string): boolean {
  if (BOT_PROTECTION_PATTERN.test(body)) {
    return true;
  }
  if (contentType.includes('text/html') && body.length < 8_000 && /Security check/i.test(body)) {
    return true;
  }
  return false;
}

export async function safeFetchTicketPage(initialUrl: string): Promise<TicketFetchResult> {
  const canonicalStart = canonicalizeTicketIoUrl(initialUrl);
  const redirectChain: string[] = [initialUrl];

  if (!canonicalStart) {
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

  if (isCheckoutOrSessionTicketUrl(canonicalStart)) {
    return {
      finalUrl: canonicalStart,
      body: '',
      contentType: '',
      fingerprint: '',
      blocked: true,
      blockReason: 'host_not_allowed',
      redirectChain,
    };
  }

  let currentUrl = canonicalStart;
  for (let redirectCount = 0; redirectCount <= DEFAULT_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/json',
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
            blockReason: 'http_error',
            redirectChain,
          };
        }
        const nextUrl = new URL(location, currentUrl).toString();
        redirectChain.push(nextUrl);
        const canonicalNext = canonicalizeTicketIoUrl(nextUrl);
        currentUrl = canonicalNext ?? nextUrl;
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
    blockReason: 'http_error',
    redirectChain,
  };
}
