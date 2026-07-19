const BLOCKED_URL_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'ftp:'];

export function isAllowedUrlProtocol(protocol: string): boolean {
  const normalized = protocol.toLowerCase();
  return normalized === 'http:' || normalized === 'https:';
}

export function resolveUrl(value: string | undefined, baseUrl?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (!isAllowedUrlProtocol(parsed.protocol)) {
      return undefined;
    }
    if (BLOCKED_URL_PROTOCOLS.includes(parsed.protocol.toLowerCase())) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function validateUrl(value: string | undefined, baseUrl?: string): {
  valid: boolean;
  url?: string;
} {
  const resolved = resolveUrl(value, baseUrl);
  if (!resolved) {
    return { valid: false };
  }
  return { valid: true, url: resolved };
}
