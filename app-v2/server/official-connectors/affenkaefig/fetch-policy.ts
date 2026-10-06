import type { SafeFetchRequestContext, SafeFetchUrlPolicy } from '../generic-safe-fetch';
import {
  AFFENKAEFIG_HOST,
  AFFENKAEFIG_USER_AGENT,
} from './constants';
import {
  canonicalizeAffenkaefigUrl,
  isAffenkaefigDetailUrl,
  isAffenkaefigListUrl,
  isAffenkaefigShortlinkUrl,
  resolveAffenkaefigRedirectUrl,
} from './url-policy';

export const affenkaefigSafeFetchPolicy: SafeFetchUrlPolicy = {
  userAgent: AFFENKAEFIG_USER_AGENT,
  canonicalizeUrl(rawUrl: string, baseUrl?: string) {
    try {
      const resolved = baseUrl ? new URL(rawUrl, baseUrl).toString() : rawUrl;
      return canonicalizeAffenkaefigUrl(resolved);
    } catch {
      return canonicalizeAffenkaefigUrl(rawUrl);
    }
  },
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null) {
    return resolveAffenkaefigRedirectUrl(currentUrl, locationHeader);
  },
  validateRequestUrl(url: string, context: SafeFetchRequestContext) {
    if (context.allowListOnly && !isAffenkaefigListUrl(url)) {
      return 'disallowed_path';
    }
    if (context.allowShortlinkFallback && isAffenkaefigShortlinkUrl(url)) {
      return null;
    }
    if (context.allowDetailOnly && !isAffenkaefigDetailUrl(url)) {
      return 'disallowed_path';
    }
    return null;
  },
  isCrossOriginRedirect(currentUrl: string, resolvedUrl: string | null) {
    if (resolvedUrl) {
      return false;
    }
    try {
      return new URL(currentUrl).hostname !== AFFENKAEFIG_HOST;
    } catch {
      return true;
    }
  },
};
