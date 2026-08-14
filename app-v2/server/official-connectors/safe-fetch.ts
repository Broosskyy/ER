import type { ConnectorErrorCounters } from './types';
import {
  canonicalizeBootshausUrl,
  isBootshausDetailUrl,
  isBootshausListUrl,
  resolveBootshausRedirectUrl,
} from './bootshaus/url-policy';
import { BOOTSHAUS_HOST, BOOTSHAUS_USER_AGENT } from './bootshaus/constants';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_REDIRECTS = 3;

export interface SafeFetchOptions {
  counters: ConnectorErrorCounters;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowListOnly?: boolean;
  allowDetailOnly?: boolean;
}

export interface SafeFetchResult {
  finalUrl: string;
  html: string;
  contentType: string;
}

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'non_https'
      | 'cross_origin'
      | 'disallowed_path'
      | 'timeout'
      | 'too_large'
      | 'invalid_mime'
      | 'redirect_loop'
      | 'http_error',
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export async function safeFetchHtml(
  initialUrl: string,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = canonicalizeBootshausUrl(initialUrl);
  if (!currentUrl) {
    options.counters.nonHttpsFetches += 1;
    throw new SafeFetchError('Only HTTPS bootshaus.tv URLs are allowed.', 'non_https');
  }

  if (options.allowListOnly && !isBootshausListUrl(currentUrl)) {
    options.counters.disallowedPathFetches += 1;
    throw new SafeFetchError('List fetch must target /events/.', 'disallowed_path');
  }

  if (options.allowDetailOnly && !isBootshausDetailUrl(currentUrl)) {
    options.counters.disallowedPathFetches += 1;
    throw new SafeFetchError('Detail fetch must target /events/{slug}/.', 'disallowed_path');
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': BOOTSHAUS_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const nextUrl = resolveBootshausRedirectUrl(currentUrl, response.headers.get('location'));
        if (!nextUrl) {
          if (new URL(currentUrl).hostname !== BOOTSHAUS_HOST) {
            options.counters.crossOriginDetailFetches += 1;
          } else {
            options.counters.disallowedPathFetches += 1;
          }
          throw new SafeFetchError('Redirect target is not allowed.', 'cross_origin');
        }

        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        throw new SafeFetchError(`HTTP ${response.status} for ${currentUrl}`, 'http_error');
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('text/html')) {
        throw new SafeFetchError(`Unexpected content type: ${contentType}`, 'invalid_mime');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new SafeFetchError('Response body is empty.', 'http_error');
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          throw new SafeFetchError('HTML response exceeded size limit.', 'too_large');
        }
        chunks.push(value);
      }

      const html = Buffer.concat(chunks).toString('utf8');
      return {
        finalUrl: currentUrl,
        html,
        contentType,
      };
    } catch (error) {
      if (error instanceof SafeFetchError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SafeFetchError('Request timed out.', 'timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new SafeFetchError('Too many redirects.', 'redirect_loop');
}
