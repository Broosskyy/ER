import { createHash } from 'node:crypto';

import type { DiscoveredTicketLink, ResolvedTicketLink } from './types';
import {
  canonicalizeFourvenuesUrl,
  canonicalizeN8ManagerTicketUrl,
  canonicalizePaylogicUrl,
  canonicalizeTicketIoUrl,
  classifyProviderKey,
  extractFourvenuesProviderEventId,
  extractPaylogicProviderEventId,
  extractTicketIoProviderEventId,
  isCheckoutOrSessionTicketUrl,
  isFourvenuesEventDetailUrl,
  isN8ManagerHost,
  isPaylogicEventDetailUrl,
  isShopRootUrl,
  isTicketIoEventDetailUrl,
} from './url-policy';

const DEFAULT_MAX_REDIRECTS = 5;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function hashPath(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function canonicalizeForProvider(url: string, providerKey: string): {
  canonical?: string;
  isEventDetail: boolean;
} {
  if (providerKey === 'ticket_io') {
    const canonical = canonicalizeTicketIoUrl(url);
    return {
      canonical,
      isEventDetail: canonical ? isTicketIoEventDetailUrl(canonical) : false,
    };
  }
  if (providerKey === 'paylogic') {
    const canonical = canonicalizePaylogicUrl(url);
    return {
      canonical,
      isEventDetail: canonical ? isPaylogicEventDetailUrl(canonical) : false,
    };
  }
  if (providerKey === 'fourvenues') {
    const canonical = canonicalizeFourvenuesUrl(url);
    return {
      canonical,
      isEventDetail: canonical ? isFourvenuesEventDetailUrl(canonical) : false,
    };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { isEventDetail: false };
    }
    parsed.hash = '';
    if (isN8ManagerHost(parsed.hostname)) {
      const canonical = canonicalizeN8ManagerTicketUrl(parsed.toString());
      return {
        canonical: canonical ?? parsed.toString(),
        isEventDetail: Boolean(canonical),
      };
    }
    return { canonical: parsed.toString(), isEventDetail: parsed.pathname.length > 1 };
  } catch {
    return { isEventDetail: false };
  }
}

export async function followRedirects(
  initialUrl: string,
  options: { maxRedirects?: number } = {},
): Promise<{ finalUrl: string; redirectChain: string[]; blocked: boolean; blockReason?: string }> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const redirectChain: string[] = [initialUrl];
  let currentUrl = initialUrl;

  for (let step = 0; step <= maxRedirects; step += 1) {
    if (isCheckoutOrSessionTicketUrl(currentUrl)) {
      return { finalUrl: currentUrl, redirectChain, blocked: true, blockReason: 'checkout_url' };
    }
    if (isShopRootUrl(currentUrl)) {
      return { finalUrl: currentUrl, redirectChain, blocked: true, blockReason: 'shop_root' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || step === maxRedirects) {
          return { finalUrl: currentUrl, redirectChain, blocked: true, blockReason: 'redirect_limit' };
        }
        const nextUrl = new URL(location, currentUrl).toString();
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      return { finalUrl: currentUrl, redirectChain, blocked: false };
    } catch {
      return { finalUrl: currentUrl, redirectChain, blocked: true, blockReason: 'fetch_error' };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { finalUrl: currentUrl, redirectChain, blocked: true, blockReason: 'redirect_limit' };
}

export async function resolveTicketLink(
  discovered: DiscoveredTicketLink,
): Promise<ResolvedTicketLink> {
  let redirect = await followRedirects(discovered.rawUrl);
  let providerKey = classifyProviderKey(redirect.finalUrl);
  let hops = 0;
  while (providerKey === 'redirector' && hops < 3 && !redirect.blocked) {
    redirect = await followRedirects(redirect.finalUrl);
    providerKey = classifyProviderKey(redirect.finalUrl);
    hops += 1;
  }
  const { canonical, isEventDetail } = canonicalizeForProvider(redirect.finalUrl, providerKey);

  let rejectedUrlReason: string | undefined;
  if (redirect.blocked) {
    rejectedUrlReason = redirect.blockReason ?? 'redirect_blocked';
  } else if (classifyProviderKey(redirect.finalUrl) === 'merchandise') {
    rejectedUrlReason = 'merchandise_link_rejected';
  } else if (!canonical) {
    rejectedUrlReason = 'non_https_or_invalid';
  } else if (isShopRootUrl(canonical)) {
    rejectedUrlReason = 'shop_root';
  } else if (isCheckoutOrSessionTicketUrl(canonical)) {
    rejectedUrlReason = 'checkout_url';
  } else if (!isEventDetail && providerKey !== 'organizer_shop') {
    rejectedUrlReason = 'not_event_detail_url';
  }

  return {
    discovered,
    resolvedUrl: redirect.finalUrl,
    canonicalTicketUrl: canonical ?? redirect.finalUrl,
    providerKey,
    redirectChain: redirect.redirectChain,
    isEventDetailUrl: isEventDetail,
    rejectedUrlReason,
  };
}

export function extractProviderEventIdFromResolved(resolved: ResolvedTicketLink): string | undefined {
  const url = resolved.canonicalTicketUrl;
  switch (resolved.providerKey) {
    case 'ticket_io':
      return extractTicketIoProviderEventId(url);
    case 'paylogic':
      return extractPaylogicProviderEventId(url);
    case 'fourvenues':
      return extractFourvenuesProviderEventId(url);
    case 'organizer_shop':
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.split('/').filter(Boolean).join('/');
        return path || hashPath(url);
      } catch {
        return hashPath(url);
      }
    default:
      return hashPath(url);
  }
}
