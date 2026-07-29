import { assertSafeImportUrl } from '@/features/import/services/import-fetch-service';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
]);

const CLOUD_METADATA_PATTERNS = [
  /^169\.254\.169\.254$/,
  /^fd00:ec2::254$/i,
  /^100\.100\.100\.200$/,
];

export function assertSafeWebsiteUrl(urlString: string): URL {
  const parsed = assertSafeImportUrl(urlString);
  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  if (CLOUD_METADATA_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new Error(`Blocked cloud metadata endpoint: ${hostname}`);
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Blocked internal hostname: ${hostname}`);
  }

  return parsed;
}

export function resolveRelativeUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function isAllowedDomain(url: string, allowedDomains?: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowedDomains.some(
      (domain) => hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`),
    );
  } catch {
    return false;
  }
}

export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const normalized = url.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
