import { importConfig } from '@/features/import/config/import-config';
import { ImportExecutionError } from '@/features/import/errors/import-errors';

export interface ImportFetchOptions {
  url: string;
  timeoutMs?: number;
  allowedContentTypes?: string[];
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ImportFetchResponse {
  requestedUrl: string;
  url: string;
  status: number;
  contentType: string;
  body: string;
  bytesRead: number;
  redirectChain: string[];
}

const SUPPORTED_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'data:', 'javascript:', 'vbscript:'];
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '[::1]', '::1']);

const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
];

const PRIVATE_IPV6_PATTERNS = [
  /^fc/i,
  /^fd/i,
  /^fe80/i,
  /^::1$/,
  /^::$/,
];

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
]);

function isPrivateIpv4(host: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(host));
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, '');
  return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function assertSafeImportUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new ImportExecutionError(`Invalid URL: ${urlString}`, 'IMPORT_EXECUTION_FAILED');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new ImportExecutionError(
      `Blocked protocol "${protocol}" — only HTTP and HTTPS are allowed.`,
      'IMPORT_EXECUTION_FAILED',
    );
  }

  if (BLOCKED_PROTOCOLS.includes(protocol)) {
    throw new ImportExecutionError(`Blocked protocol: ${protocol}`, 'IMPORT_EXECUTION_FAILED');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new ImportExecutionError(`Blocked hostname: ${hostname}`, 'IMPORT_EXECUTION_FAILED');
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new ImportExecutionError(`Blocked private address: ${hostname}`, 'IMPORT_EXECUTION_FAILED');
  }

  return parsed;
}

export function sanitizeFetchHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      safe[key] = value;
    }
  }
  return safe;
}

function isContentTypeAllowed(contentType: string, allowed?: string[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return allowed.some((type) => normalized.includes(type.toLowerCase()));
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; bytesRead: number }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new ImportExecutionError('Response exceeds maximum allowed size.', 'IMPORT_EXECUTION_FAILED');
    }
    return { body: text, bytesRead: text.length };
  }

  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      throw new ImportExecutionError('Response exceeds maximum allowed size.', 'IMPORT_EXECUTION_FAILED');
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();

  return { body, bytesRead };
}

export class ImportFetchService {
  async fetch(options: ImportFetchOptions): Promise<ImportFetchResponse> {
    const timeoutMs = options.timeoutMs ?? importConfig.timeoutMs;
    const maxBytes = importConfig.maxResponseBytes;
    let lastError: unknown;

    for (let attempt = 0; attempt <= importConfig.retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const signals = [controller.signal];
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const result = await this.fetchWithRedirects(
          options.url,
          {
            headers: sanitizeFetchHeaders(options.headers),
            signal: controller.signal,
            allowedContentTypes: options.allowedContentTypes,
          },
          maxBytes,
          options.url,
          [options.url],
          new Set([options.url]),
        );
        clearTimeout(timeoutId);
        return result;
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        lastError = error;
        if (attempt >= importConfig.retryCount) {
          break;
        }
      }
    }

    if (lastError instanceof ImportExecutionError) {
      throw lastError;
    }
    if (lastError instanceof Error && lastError.name === 'AbortError') {
      throw new ImportExecutionError('Fetch request timed out.', 'IMPORT_TIMEOUT', lastError);
    }
    throw new ImportExecutionError(
      lastError instanceof Error ? lastError.message : 'Fetch failed.',
      'IMPORT_EXECUTION_FAILED',
      lastError,
    );
  }

  private async fetchWithRedirects(
    url: string,
    options: {
      headers: Record<string, string>;
      signal: AbortSignal;
      allowedContentTypes?: string[];
    },
    maxBytes: number,
    requestedUrl: string,
    redirectChain: string[],
    visitedUrls: Set<string>,
    redirectCount = 0,
  ): Promise<ImportFetchResponse> {
    assertSafeImportUrl(url);

    const response = await fetch(url, {
      method: 'GET',
      headers: options.headers,
      signal: options.signal,
      redirect: 'manual',
    });

    if (SUPPORTED_REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new ImportExecutionError('Redirect without location header.', 'IMPORT_EXECUTION_FAILED');
      }
      if (redirectCount >= MAX_REDIRECTS) {
        throw new ImportExecutionError('Too many redirects.', 'IMPORT_EXECUTION_FAILED');
      }
      const nextUrl = new URL(location, url).toString();
      assertSafeImportUrl(nextUrl);
      if (visitedUrls.has(nextUrl)) {
        throw new ImportExecutionError('Redirect loop detected.', 'IMPORT_EXECUTION_FAILED');
      }
      const nextVisitedUrls = new Set(visitedUrls);
      nextVisitedUrls.add(nextUrl);
      return this.fetchWithRedirects(
        nextUrl,
        options,
        maxBytes,
        requestedUrl,
        [...redirectChain, nextUrl],
        nextVisitedUrls,
        redirectCount + 1,
      );
    }

    if (!response.ok) {
      throw new ImportExecutionError(`HTTP ${response.status} for ${url}`, 'IMPORT_EXECUTION_FAILED');
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    if (!isContentTypeAllowed(contentType, options.allowedContentTypes)) {
      throw new ImportExecutionError(
        `Unexpected content type: ${contentType}`,
        'IMPORT_EXECUTION_FAILED',
      );
    }

    const { body, bytesRead } = await readLimitedBody(response, maxBytes);

    return {
      requestedUrl,
      url: response.url || url,
      status: response.status,
      contentType,
      body,
      bytesRead,
      redirectChain,
    };
  }
}

export const importFetchService = new ImportFetchService();
