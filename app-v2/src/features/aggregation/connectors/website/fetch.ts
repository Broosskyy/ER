import {
  assertSafeImportUrl,
  importFetchService,
  sanitizeFetchHeaders,
  type ImportFetchOptions,
  type ImportFetchResponse,
} from '@/features/import/services/import-fetch-service';
import { importConfig } from '@/features/import/config/import-config';
import { assertSafeWebsiteUrl } from '@/features/aggregation/connectors/website/security';
import type { WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import type { WebsiteRunLimits } from '@/features/aggregation/connectors/website/limits';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';

export interface WebsiteFetchRequest {
  url: string;
  config?: WebsiteConnectorConfig;
  limits?: Partial<WebsiteRunLimits>;
  htmlOverride?: string;
}

export interface WebsiteFetchErrorDetail {
  code: 'invalid_url' | 'timeout' | 'network_error' | 'response_too_large' | 'unsupported_content_type';
  message: string;
  retryable: boolean;
}

export class WebsiteFetchError extends Error {
  readonly detail: WebsiteFetchErrorDetail;

  constructor(detail: WebsiteFetchErrorDetail) {
    super(detail.message);
    this.name = 'WebsiteFetchError';
    this.detail = detail;
  }
}

function parseCharset(contentType: string): string | undefined {
  const match = /charset=([^;]+)/i.exec(contentType);
  return match?.[1]?.trim().replace(/['"]/g, '');
}

function buildDocument(
  request: WebsiteFetchRequest,
  response: ImportFetchResponse,
): WebsiteDocument {
  return {
    requestedUrl: response.requestedUrl || request.url,
    finalUrl: response.url || request.url,
    statusCode: response.status,
    contentType: response.contentType,
    charset: parseCharset(response.contentType),
    html: response.body,
    responseSize: response.bytesRead,
    fetchedAt: new Date().toISOString(),
    redirectChain: response.redirectChain,
    headers: {},
    detectedSignals: [],
    warnings: [],
  };
}

export class WebsiteFetchLayer {
  async fetchDocument(request: WebsiteFetchRequest): Promise<WebsiteDocument> {
    if (request.htmlOverride !== undefined) {
      assertSafeWebsiteUrl(request.url);
      return {
        requestedUrl: request.url,
        finalUrl: request.url,
        statusCode: 200,
        contentType: 'text/html',
        html: request.htmlOverride,
        responseSize: request.htmlOverride.length,
        fetchedAt: new Date().toISOString(),
        redirectChain: [request.url],
        headers: {},
        detectedSignals: [],
        warnings: ['fixture_html_override'],
      };
    }

    try {
      assertSafeWebsiteUrl(request.url);
    } catch (error) {
      throw new WebsiteFetchError({
        code: 'invalid_url',
        message: error instanceof Error ? error.message : 'Invalid website URL.',
        retryable: false,
      });
    }

    const options: ImportFetchOptions = {
      url: request.url,
      timeoutMs: request.limits?.timeoutMs ?? importConfig.timeoutMs,
      allowedContentTypes: [
        'text/html',
        'application/json',
        'application/ld+json',
        'text/plain',
      ],
      headers: sanitizeFetchHeaders({
        ...(request.config?.requestHeaders ?? {}),
        ...(request.config?.userAgent ? { 'User-Agent': request.config.userAgent } : {}),
        ...(request.config?.acceptLanguage ? { 'Accept-Language': request.config.acceptLanguage } : {}),
      }),
    };

    try {
      const response = await importFetchService.fetch(options);
      return buildDocument(request, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Website fetch failed.';
      const code = message.toLowerCase().includes('timed out') ? 'timeout' : 'network_error';
      throw new WebsiteFetchError({
        code,
        message,
        retryable: code === 'timeout' || code === 'network_error',
      });
    }
  }
}

export const websiteFetchLayer = new WebsiteFetchLayer();

// Re-export for tests and redirect validation reuse.
export { assertSafeImportUrl };
