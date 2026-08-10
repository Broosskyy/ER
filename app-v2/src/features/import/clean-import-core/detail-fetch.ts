import {
  assertSafeImportUrl,
  importFetchService,
} from '@/features/import/services/import-fetch-service';

export interface DetailFetchResponse {
  html?: string;
  status: 'ok' | 'not_found' | 'timeout' | 'http_error';
  httpStatus?: number;
  error?: string;
}

export type DetailFetch = (url: string) => Promise<DetailFetchResponse>;

const DEFAULT_TIMEOUT_MS = 15_000;

/** Uses the existing bounded import fetch service; callers can inject an offline replacement. */
export function createSafeDetailFetch(options?: {
  timeoutMs?: number;
  userAgent?: string;
}): DetailFetch {
  return async (url) => {
    try {
      assertSafeImportUrl(url);
      const response = await importFetchService.fetch({
        url,
        timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        allowedContentTypes: ['text/html', 'application/json', 'application/ld+json', 'text/plain'],
        headers: options?.userAgent ? { 'User-Agent': options.userAgent } : undefined,
      });
      return {
        html: response.body,
        status: 'ok',
        httpStatus: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'detail_fetch_failed';
      if (/\b404\b/.test(message)) {
        return { status: 'not_found', httpStatus: 404, error: message };
      }
      if (/timed out|timeout/i.test(message)) {
        return { status: 'timeout', error: message };
      }
      return { status: 'http_error', error: message };
    }
  };
}
