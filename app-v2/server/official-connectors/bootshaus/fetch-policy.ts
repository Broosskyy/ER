import type { SafeFetchRequestContext, SafeFetchUrlPolicy } from '../generic-safe-fetch';
import {
  BOOTSHAUS_HOST,
  BOOTSHAUS_LIST_URL,
  BOOTSHAUS_USER_AGENT,
} from './constants';
import {
  canonicalizeBootshausUrl,
  isBootshausDetailUrl,
  isBootshausListUrl,
  resolveBootshausRedirectUrl,
} from './url-policy';

export const bootshausSafeFetchPolicy: SafeFetchUrlPolicy = {
  userAgent: BOOTSHAUS_USER_AGENT,
  canonicalizeUrl(rawUrl: string, baseUrl?: string) {
    try {
      const resolved = baseUrl ? new URL(rawUrl, baseUrl).toString() : rawUrl;
      return canonicalizeBootshausUrl(resolved);
    } catch {
      return canonicalizeBootshausUrl(rawUrl);
    }
  },
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null) {
    return resolveBootshausRedirectUrl(currentUrl, locationHeader);
  },
  validateRequestUrl(url: string, context: SafeFetchRequestContext) {
    if (context.allowListOnly && !isBootshausListUrl(url)) {
      return 'disallowed_path';
    }
    if (context.allowDetailOnly && !isBootshausDetailUrl(url)) {
      return 'disallowed_path';
    }
    return null;
  },
  isCrossOriginRedirect(currentUrl: string, resolvedUrl: string | null) {
    if (resolvedUrl) {
      return false;
    }
    try {
      return new URL(currentUrl).hostname !== BOOTSHAUS_HOST;
    } catch {
      return true;
    }
  },
};

export function canonicalizeBootshausFetchUrl(rawUrl: string, baseUrl: string = BOOTSHAUS_LIST_URL): string | null {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    return canonicalizeBootshausUrl(parsed.toString());
  } catch {
    return canonicalizeBootshausUrl(rawUrl);
  }
}
