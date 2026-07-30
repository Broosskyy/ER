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

export function isDuplicateOnboardingHostname(
  hostname: string,
  existingHostnames: string[],
): string | undefined {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');
  return existingHostnames.find((entry) => {
    const candidate = entry.toLowerCase().replace(/^www\./, '');
    return candidate === normalized;
  });
}

export const SOURCE_DISCOVERY_MAX_REDIRECTS = MAX_REDIRECTS;
