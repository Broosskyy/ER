import {
  assertSafeImportUrl,
  importFetchService,
  type ImportFetchResponse,
} from '@/features/import/services/import-fetch-service';

import type { DetailFetchFn } from './detail-evidence-service';

const DEFAULT_TIMEOUT_MS = 15000;

export function createBulkDetailFetchFn(options?: {
  timeoutMs?: number;
  userAgent?: string;
}): DetailFetchFn {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (url: string): Promise<{ html?: string; status: number; error?: string }> => {
    try {
      assertSafeImportUrl(url);
      const response: ImportFetchResponse = await importFetchService.fetch({
        url,
        timeoutMs,
        allowedContentTypes: ['text/html', 'application/json', 'application/ld+json', 'text/plain'],
        headers: options?.userAgent ? { 'User-Agent': options.userAgent } : undefined,
      });
      if (response.status === 404) {
        return { status: 404, error: 'not_found' };
      }
      if (response.status >= 400) {
        return { status: response.status, error: `http_${response.status}` };
      }
      return { html: response.body, status: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'fetch_failed';
      if (message.toLowerCase().includes('timed out')) {
        return { status: 0, error: 'timeout' };
      }
      return { status: 0, error: 'fetch_failed' };
    }
  };
}
