import {
  HttpClientError,
  type HttpClient,
  type HttpRequestOptions,
  type HttpResponse,
} from '@/features/endpoints/contracts/http-abstraction';
import {
  assertHttpUrl,
  headersRecordFromFetch,
  isAcceptedContentType,
  normalizeContentType,
} from '@/features/endpoints/http/http-client-utils';

export const DEFAULT_HTTP_MAX_REDIRECTS = 5;

export type FetchImplementation = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    redirect?: RequestRedirect;
  },
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null; forEach?: (cb: (value: string, key: string) => void) => void };
  text(): Promise<string>;
}>;

export class DefaultHttpClient implements HttpClient {
  constructor(private readonly fetchImpl: FetchImplementation = globalThis.fetch.bind(globalThis)) {}

  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    const started = Date.now();
    assertHttpUrl(options.url);

    const method = options.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      throw new HttpClientError({
        code: 'HTTP_UNKNOWN',
        message: `Unsupported HTTP method "${method}" for DefaultHttpClient.`,
        url: options.url,
      });
    }

    const followRedirects = options.followRedirects ?? true;
    const maxRedirects = options.maxRedirects ?? DEFAULT_HTTP_MAX_REDIRECTS;
    const acceptedContentTypes = options.acceptedContentTypes ?? [];
    const timeoutMs = options.timeoutMs;

    return this.requestWithRedirects(
      options.url,
      {
        method,
        headers: options.headers ?? {},
        timeoutMs,
        followRedirects,
        maxRedirects,
        acceptedContentTypes,
      },
      started,
      0,
      new Set<string>(),
    );
  }

  private async requestWithRedirects(
    url: string,
    options: {
      method: 'GET' | 'HEAD';
      headers: Record<string, string>;
      timeoutMs?: number;
      followRedirects: boolean;
      maxRedirects: number;
      acceptedContentTypes: string[];
    },
    startedAt: number,
    redirectCount: number,
    visited: Set<string>,
  ): Promise<HttpResponse> {
    assertHttpUrl(url);

    if (visited.has(url)) {
      throw new HttpClientError({
        code: 'HTTP_REDIRECT_LIMIT',
        message: 'Redirect loop detected.',
        url,
        retryable: false,
      });
    }
    visited.add(url);

    const controller = new AbortController();
    const timeoutId =
      options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : undefined;

    try {
      const response = await this.fetchImpl(url, {
        method: options.method,
        headers: options.headers,
        signal: controller.signal,
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        if (!options.followRedirects) {
          throw new HttpClientError({
            code: 'HTTP_STATUS',
            message: `Redirect status ${response.status} received but redirects are disabled.`,
            status: response.status,
            url,
          });
        }

        const location = response.headers.get('location');
        if (!location) {
          throw new HttpClientError({
            code: 'HTTP_STATUS',
            message: 'Redirect response missing location header.',
            status: response.status,
            url,
          });
        }

        if (redirectCount >= options.maxRedirects) {
          throw new HttpClientError({
            code: 'HTTP_REDIRECT_LIMIT',
            message: `Maximum redirect count (${options.maxRedirects}) exceeded.`,
            url,
          });
        }

        const nextUrl = new URL(location, url).toString();
        return this.requestWithRedirects(
          nextUrl,
          options,
          startedAt,
          redirectCount + 1,
          visited,
        );
      }

      if (response.status !== 200) {
        throw new HttpClientError({
          code: 'HTTP_STATUS',
          message: `HTTP ${response.status} for ${url}`,
          status: response.status,
          url,
          retryable: response.status >= 500,
        });
      }

      const headers = headersRecordFromFetch(response.headers);
      const contentType = normalizeContentType(headers['content-type']);

      if (
        options.acceptedContentTypes.length > 0 &&
        !isAcceptedContentType(contentType, options.acceptedContentTypes)
      ) {
        throw new HttpClientError({
          code: 'HTTP_CONTENT_TYPE',
          message: `Unsupported content type "${contentType || 'unknown'}".`,
          status: response.status,
          url,
        });
      }

      const body = options.method === 'HEAD' ? '' : await response.text();

      return {
        status: response.status,
        headers,
        body,
        finalUrl: response.url || url,
        contentType: contentType || undefined,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof HttpClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpClientError({
          code: 'HTTP_TIMEOUT',
          message: 'HTTP request timed out.',
          url,
          retryable: true,
          cause: error,
        });
      }
      throw new HttpClientError({
        code: 'HTTP_NETWORK',
        message: error instanceof Error ? error.message : 'Network request failed.',
        url,
        retryable: true,
        cause: error,
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
