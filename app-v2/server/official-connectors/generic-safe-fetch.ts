export type SafeFetchErrorCode =
  | 'non_https'
  | 'cross_origin'
  | 'disallowed_path'
  | 'timeout'
  | 'too_large'
  | 'invalid_mime'
  | 'redirect_loop'
  | 'http_error';

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly code: SafeFetchErrorCode,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchPolicyCounters {
  nonHttpsFetches: number;
  crossOriginDetailFetches: number;
  disallowedPathFetches: number;
}

export interface SafeFetchRequestContext {
  allowListOnly?: boolean;
  allowDetailOnly?: boolean;
  allowShortlinkFallback?: boolean;
}

export interface SafeFetchUrlPolicy {
  canonicalizeUrl(rawUrl: string, baseUrl?: string): string | null;
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null): string | null;
  validateRequestUrl(url: string, context: SafeFetchRequestContext): SafeFetchErrorCode | null;
  isCrossOriginRedirect?(currentUrl: string, resolvedUrl: string | null): boolean;
  userAgent: string;
}

export interface SafeFetchRequestOptions {
  counters: SafeFetchPolicyCounters;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  finalUrl: string;
  html: string;
  contentType: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_REDIRECTS = 3;

export async function safeFetchHtmlWithPolicy(
  initialUrl: string,
  policy: SafeFetchUrlPolicy,
  options: SafeFetchRequestOptions,
  context: SafeFetchRequestContext = {},
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = policy.canonicalizeUrl(initialUrl);
  if (!currentUrl) {
    options.counters.nonHttpsFetches += 1;
    throw new SafeFetchError('Only HTTPS URLs are allowed for this source policy.', 'non_https');
  }

  const requestViolation = policy.validateRequestUrl(currentUrl, context);
  if (requestViolation) {
    if (requestViolation === 'cross_origin') {
      options.counters.crossOriginDetailFetches += 1;
    } else {
      options.counters.disallowedPathFetches += 1;
    }
    throw new SafeFetchError('Request URL is not allowed by source policy.', requestViolation);
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
          'User-Agent': policy.userAgent,
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const nextUrl = policy.resolveRedirectUrl(currentUrl, response.headers.get('location'));
        if (!nextUrl) {
          if (policy.isCrossOriginRedirect?.(currentUrl, null)) {
            options.counters.crossOriginDetailFetches += 1;
            throw new SafeFetchError('Redirect target is not allowed.', 'cross_origin');
          }
          options.counters.disallowedPathFetches += 1;
          throw new SafeFetchError('Redirect target is not allowed.', 'disallowed_path');
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
