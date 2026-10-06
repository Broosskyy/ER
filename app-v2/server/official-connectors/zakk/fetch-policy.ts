import type { SafeFetchRequestContext, SafeFetchUrlPolicy } from '../generic-safe-fetch';
import { ZAKK_HOST, ZAKK_USER_AGENT } from './constants';
import {
  canonicalizeZakkUrl,
  isZakkEventDetailUrl,
  isZakkPartyListUrl,
  resolveZakkRedirectUrl,
} from './url-policy';

function isZakkHost(hostname: string): boolean {
  return hostname === ZAKK_HOST || hostname === 'www.zakk.de';
}

export const zakkSafeFetchPolicy: SafeFetchUrlPolicy = {
  userAgent: ZAKK_USER_AGENT,
  canonicalizeUrl(rawUrl: string, baseUrl?: string) {
    try {
      const resolved = baseUrl ? new URL(rawUrl, baseUrl).toString() : rawUrl;
      return canonicalizeZakkUrl(resolved);
    } catch {
      return canonicalizeZakkUrl(rawUrl);
    }
  },
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null) {
    return resolveZakkRedirectUrl(currentUrl, locationHeader);
  },
  validateRequestUrl(url: string, context: SafeFetchRequestContext) {
    if (context.allowListOnly && !isZakkPartyListUrl(url)) {
      return 'disallowed_path';
    }
    if (context.allowDetailOnly && !isZakkEventDetailUrl(url)) {
      return 'disallowed_path';
    }
    return null;
  },
  isCrossOriginRedirect(currentUrl: string, resolvedUrl: string | null) {
    if (resolvedUrl) {
      try {
        const resolvedHost = new URL(resolvedUrl).hostname;
        return !isZakkHost(resolvedHost);
      } catch {
        return true;
      }
    }
    try {
      return !isZakkHost(new URL(currentUrl).hostname);
    } catch {
      return true;
    }
  },
};
