import { HttpClientError } from '@/features/endpoints/contracts/http-abstraction';

const BLOCKED_PROTOCOLS = new Set(['file:', 'ftp:', 'data:', 'javascript:', 'vbscript:']);

export function assertHttpUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new HttpClientError({
      code: 'HTTP_INVALID_URL',
      message: `Invalid URL: ${urlString}`,
      url: urlString,
    });
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new HttpClientError({
      code: 'HTTP_INVALID_URL',
      message: `Unsupported protocol "${protocol}" — only HTTP and HTTPS are allowed.`,
      url: urlString,
    });
  }

  if (BLOCKED_PROTOCOLS.has(protocol)) {
    throw new HttpClientError({
      code: 'HTTP_INVALID_URL',
      message: `Blocked protocol: ${protocol}`,
      url: urlString,
    });
  }

  return parsed;
}

export function normalizeContentType(contentType: string | null | undefined): string {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isAcceptedContentType(contentType: string, accepted: string[]): boolean {
  if (accepted.length === 0) {
    return true;
  }
  const normalized = normalizeContentType(contentType);
  return accepted.some((entry) => normalized === entry.toLowerCase());
}

export function headersRecordFromFetch(headers: {
  get(name: string): string | null;
  forEach?(callback: (value: string, key: string) => void): void;
}): Record<string, string> {
  const record: Record<string, string> = {};
  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value;
    });
    return record;
  }

  const contentType = headers.get('content-type');
  if (contentType) {
    record['content-type'] = contentType;
  }
  const contentLength = headers.get('content-length');
  if (contentLength) {
    record['content-length'] = contentLength;
  }
  return record;
}
