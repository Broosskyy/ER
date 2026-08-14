import { createHash } from 'node:crypto';

import type { ConnectorErrorCounters } from '../types';

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 8_000_000;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class SafeImageFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'non_https'
      | 'host_not_allowed'
      | 'timeout'
      | 'too_large'
      | 'invalid_mime'
      | 'redirect_loop'
      | 'http_error'
      | 'html_response',
  ) {
    super(message);
    this.name = 'SafeImageFetchError';
  }
}

export interface SafeImageFetchOptions {
  counters: ConnectorErrorCounters;
  allowedHosts: ReadonlySet<string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
}

export interface SafeImageFetchResult {
  finalUrl: string;
  bytes: Buffer;
  mimeType: string;
  fingerprint: string;
}

function normalizeMimeType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}

function isHtmlPayload(bytes: Buffer): boolean {
  const prefix = bytes.subarray(0, Math.min(bytes.length, 256)).toString('utf8').trimStart().toLowerCase();
  return prefix.startsWith('<!doctype html') || prefix.startsWith('<html');
}

export function fingerprintImageBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function safeFetchImage(
  initialUrl: string,
  options: SafeImageFetchOptions,
): Promise<SafeImageFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? 3;
  const userAgent = options.userAgent ?? 'EternalRaveOfficialConnector/1.0';

  let currentUrl = initialUrl;
  if (!currentUrl.startsWith('https://')) {
    options.counters.nonHttpsFetches += 1;
    throw new SafeImageFetchError('Only HTTPS image URLs are allowed.', 'non_https');
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const parsed = new URL(currentUrl);
    if (!options.allowedHosts.has(parsed.hostname)) {
      throw new SafeImageFetchError(`Host not allowed: ${parsed.hostname}`, 'host_not_allowed');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'image/jpeg,image/png,image/webp',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new SafeImageFetchError('Redirect without location header.', 'redirect_loop');
        }
        currentUrl = new URL(location, currentUrl).toString();
        if (!currentUrl.startsWith('https://')) {
          options.counters.nonHttpsFetches += 1;
          throw new SafeImageFetchError('Redirect target must be HTTPS.', 'non_https');
        }
        continue;
      }

      if (!response.ok) {
        throw new SafeImageFetchError(`HTTP ${response.status} for ${currentUrl}`, 'http_error');
      }

      const mimeType = normalizeMimeType(response.headers.get('content-type') ?? '');
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new SafeImageFetchError(`Unexpected content type: ${mimeType}`, 'invalid_mime');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new SafeImageFetchError('Response body is empty.', 'http_error');
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
          throw new SafeImageFetchError('Image exceeded size limit.', 'too_large');
        }
        chunks.push(value);
      }

      const bytes = Buffer.concat(chunks);
      if (isHtmlPayload(bytes)) {
        throw new SafeImageFetchError('HTML response is not a valid image.', 'html_response');
      }

      options.counters.imagesDownloaded += 1;
      return {
        finalUrl: currentUrl,
        bytes,
        mimeType,
        fingerprint: fingerprintImageBytes(bytes),
      };
    } catch (error) {
      if (error instanceof SafeImageFetchError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SafeImageFetchError('Request timed out.', 'timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new SafeImageFetchError('Too many redirects.', 'redirect_loop');
}

export function buildImageHostAllowlist(imageUrls: string[]): Set<string> {
  const hosts = new Set<string>();
  for (const url of imageUrls) {
    if (!url.startsWith('https://')) {
      continue;
    }
    hosts.add(new URL(url).hostname);
  }
  return hosts;
}
