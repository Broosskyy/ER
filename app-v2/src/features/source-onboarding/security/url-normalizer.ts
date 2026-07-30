import { assertSafeImportUrl } from '@/features/import/services/import-fetch-service';

const MAX_REDIRECTS = 5;

export interface NormalizedSourceUrl {
  original: string;
  normalized: string;
  hostname: string;
  protocol: 'https:' | 'http:';
}

export function normalizeSubmittedSourceUrl(url: string): NormalizedSourceUrl {
  const trimmed = url.trim();
  if (/^(file|ftp|data|javascript):/i.test(trimmed)) {
    throw new Error(`Unsupported protocol in URL: ${trimmed}`);
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = assertSafeImportUrl(withProtocol);

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  const normalized = new URL(parsed.toString());
  normalized.hash = '';
  if (normalized.pathname !== '/' && normalized.pathname.endsWith('/')) {
    normalized.pathname = normalized.pathname.replace(/\/+$/, '') || '/';
  }

  const preferred =
    normalized.protocol === 'http:'
      ? new URL(normalized.toString().replace(/^http:/, 'https:'))
      : normalized;

  return {
    original: url,
    normalized: preferred.toString(),
    hostname: preferred.hostname.toLowerCase(),
    protocol: preferred.protocol as 'https:' | 'http:',
  };
}

export interface RegisteredSourceHostname {
  hostname: string;
  sourceId: string;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

export function findDuplicateSourceIdByHostname(
  hostname: string,
  registered: RegisteredSourceHostname[],
): string | undefined {
  const normalized = normalizeHostname(hostname);
  return registered.find((entry) => normalizeHostname(entry.hostname) === normalized)?.sourceId;
}

/** @deprecated Use findDuplicateSourceIdByHostname for FK-safe duplicate_source_id persistence. */
export function isDuplicateOnboardingHostname(
  hostname: string,
  existingHostnames: string[],
): string | undefined {
  const normalized = normalizeHostname(hostname);
  return existingHostnames.find((entry) => normalizeHostname(entry) === normalized);
}

export const SOURCE_DISCOVERY_MAX_REDIRECTS = MAX_REDIRECTS;
