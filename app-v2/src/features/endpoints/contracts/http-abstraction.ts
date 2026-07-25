/**
 * Provider-independent HTTP abstraction (contracts only).
 *
 * ER-014 Part 1: interfaces and error mapping design — no implementation.
 * Website Connector (and future connectors) depend on this contract, not fetch/axios directly.
 */

export type HttpMethod = 'GET' | 'HEAD' | 'POST';

export interface HttpRequestOptions {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  /** Resolved from endpoint config, connector settings, or global defaults. */
  timeoutMs?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  /** Expected content types — validation happens in HTTP layer, not connectors. */
  acceptedContentTypes?: string[];
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
  contentType?: string;
  durationMs: number;
}

export interface HttpClient {
  request(options: HttpRequestOptions): Promise<HttpResponse>;
}

/**
 * HTTP-layer failure codes mapped into ConnectorErrorCategory at execution time.
 * Connectors translate HttpClientError → ConnectorErrorDetail via createConnectorErrorDetail.
 */
export const HTTP_CLIENT_ERROR_CODES = [
  'HTTP_TIMEOUT',
  'HTTP_NETWORK',
  'HTTP_REDIRECT_LIMIT',
  'HTTP_STATUS',
  'HTTP_CONTENT_TYPE',
  'HTTP_INVALID_URL',
  'HTTP_UNKNOWN',
] as const;

export type HttpClientErrorCode = (typeof HTTP_CLIENT_ERROR_CODES)[number];

export interface HttpClientErrorOptions {
  code: HttpClientErrorCode;
  message: string;
  status?: number;
  url?: string;
  retryable?: boolean;
  cause?: unknown;
}

/**
 * HTTP abstraction error — translated to ConnectorErrorDetail, not thrown across connector boundary.
 */
export class HttpClientError extends Error {
  readonly code: HttpClientErrorCode;
  readonly status?: number;
  readonly url?: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(options: HttpClientErrorOptions) {
    super(options.message);
    this.name = 'HttpClientError';
    this.code = options.code;
    this.status = options.status;
    this.url = options.url;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

/**
 * Maps HTTP client errors to connector error categories.
 * Used by Website Connector in future parts — defined here for architectural consistency.
 */
export function mapHttpErrorToConnectorCategory(
  code: HttpClientErrorCode,
): import('@/features/connectors/errors/connector-errors').ConnectorErrorCategory {
  switch (code) {
    case 'HTTP_TIMEOUT':
      return 'timeout';
    case 'HTTP_NETWORK':
    case 'HTTP_REDIRECT_LIMIT':
    case 'HTTP_STATUS':
      return 'connectivity';
    case 'HTTP_CONTENT_TYPE':
    case 'HTTP_INVALID_URL':
      return 'configuration';
    default:
      return 'unknown';
  }
}
