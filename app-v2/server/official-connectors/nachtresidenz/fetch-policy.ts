import type { SafeFetchRequestContext, SafeFetchUrlPolicy } from '../generic-safe-fetch';
import {
  NACHTRESIDENZ_HOST,
  NACHTRESIDENZ_USER_AGENT,
} from './constants';
import {
  canonicalizeNachtresidenzUrl,
  isNachtresidenzEventUrl,
  isNachtresidenzListUrl,
  resolveNachtresidenzRedirectUrl,
} from './url-policy';

export const nachtresidenzSafeFetchPolicy: SafeFetchUrlPolicy = {
  userAgent: NACHTRESIDENZ_USER_AGENT,
  canonicalizeUrl(rawUrl: string, baseUrl?: string) {
    try {
      const resolved = baseUrl ? new URL(rawUrl, baseUrl).toString() : rawUrl;
      return canonicalizeNachtresidenzUrl(resolved);
    } catch {
      return canonicalizeNachtresidenzUrl(rawUrl);
    }
  },
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null) {
    return resolveNachtresidenzRedirectUrl(currentUrl, locationHeader);
  },
  validateRequestUrl(url: string, context: SafeFetchRequestContext) {
    if (context.allowListOnly && !isNachtresidenzListUrl(url)) {
      return 'disallowed_path';
    }
    if (context.allowDetailOnly && !isNachtresidenzEventUrl(url)) {
      return 'disallowed_path';
    }
    return null;
  },
  isCrossOriginRedirect(currentUrl: string, resolvedUrl: string | null) {
    if (resolvedUrl) {
      return false;
    }
    try {
      return new URL(currentUrl).hostname !== NACHTRESIDENZ_HOST;
    } catch {
      return true;
    }
  },
};
